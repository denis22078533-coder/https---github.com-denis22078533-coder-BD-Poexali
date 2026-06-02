"""
Генерация PDF со списком документов и их фотографиями.
Сохраняет PDF в Яндекс S3 и возвращает URL.
GET / — все документы (до 40)
GET /?ids=1,2,3 — только указанные документы
"""
import json
import os
import io
import gc
import boto3
import requests
import psycopg2
from datetime import datetime
from botocore.config import Config

SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "t_p79040548_accounting_automatio")
CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
}

MAX_IMG_PX = 600
JPEG_QUALITY = 50
FONT_PATH = "/tmp/DejaVuSans.ttf"
FONT_FALLBACK_URL = "https://cdn.jsdelivr.net/npm/dejavu-fonts-ttf@2.37.3/ttf/DejaVuSans.ttf"


def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def resp(status, body):
    return {"statusCode": status, "headers": CORS, "body": json.dumps(body, ensure_ascii=False, default=str)}


def load_font() -> str:
    """Загружает DejaVuSans с кириллицей. Возвращает имя шрифта."""
    if not (os.path.exists(FONT_PATH) and os.path.getsize(FONT_PATH) > 50_000):
        try:
            r = requests.get(FONT_FALLBACK_URL, timeout=20)
            if r.status_code == 200 and len(r.content) > 50_000:
                with open(FONT_PATH, "wb") as f:
                    f.write(r.content)
                print(f"[docs-pdf] Font loaded from CDN, size={len(r.content)}")
        except Exception as e2:
            print(f"[docs-pdf] Font download failed: {e2}")

    if os.path.exists(FONT_PATH) and os.path.getsize(FONT_PATH) > 50_000:
        from reportlab.pdfbase import pdfmetrics
        from reportlab.pdfbase.ttfonts import TTFont
        try:
            pdfmetrics.getFont("DejaVu")
        except Exception:
            pdfmetrics.registerFont(TTFont("DejaVu", FONT_PATH))
            pdfmetrics.registerFont(TTFont("DejaVu-Bold", FONT_PATH))
        return "DejaVu"
    return "Helvetica"


def compress_image(url: str):
    """Скачивает и сжимает до MAX_IMG_PX px, возвращает (bytes, w, h) или None."""
    from PIL import Image as PILImage
    try:
        r = requests.get(url, timeout=12)
        if r.status_code != 200:
            return None
        img = PILImage.open(io.BytesIO(r.content)).convert("RGB")
        w, h = img.size
        if max(w, h) > MAX_IMG_PX:
            scale = MAX_IMG_PX / max(w, h)
            img = img.resize((int(w * scale), int(h * scale)), PILImage.LANCZOS)
            w, h = img.size
        out = io.BytesIO()
        img.save(out, format="JPEG", quality=JPEG_QUALITY, optimize=True)
        img.close()
        gc.collect()
        return out.getvalue(), w, h
    except Exception as e:
        print(f"[docs-pdf] img err {url}: {e}")
        return None


def get_yandex_s3_cfg(conn):
    cur = conn.cursor()
    try:
        cur.execute(
            f"SELECT bucket_name, endpoint_url, access_key, secret_key, use_yandex "
            f"FROM {SCHEMA}.s3_settings WHERE id=1"
        )
        row = cur.fetchone()
        if not row or not row[4] or not row[2]:
            return None
        endpoint = (row[1] or "https://storage.yandexcloud.net").rstrip("/")
        if not endpoint.startswith("http"):
            endpoint = "https://" + endpoint
        return {"bucket": row[0], "endpoint": endpoint, "access_key": row[2], "secret_key": row[3]}
    finally:
        cur.close()


def save_pdf(pdf_bytes: bytes, filename: str, yc) -> str:
    """Сохраняет PDF в Яндекс Object Storage. yc должен быть настроен."""
    if not yc:
        raise RuntimeError("Яндекс Object Storage не настроен.")
    key = f"reports/{filename}"
    s3 = boto3.client(
        "s3",
        endpoint_url=yc["endpoint"],
        aws_access_key_id=yc["access_key"],
        aws_secret_access_key=yc["secret_key"],
        config=Config(s3={"addressing_style": "virtual"}),
        region_name="ru-central1",
    )
    s3.put_object(
        Bucket=yc["bucket"],
        Key=key,
        Body=pdf_bytes,
        ContentType="application/pdf",
        ContentDisposition=f'attachment; filename="{filename}"'
    )
    url = f"{yc['endpoint']}/{yc['bucket']}/{key}"
    return url


def draw_doc_slot(c, doc, num, x, y, slot_w, slot_h, font, max_img_h):
    from reportlab.lib.utils import ImageReader
    from reportlab.lib.units import cm

    font_b = "DejaVu-Bold" if font == "DejaVu" else "Helvetica-Bold"
    font_r = font if font == "DejaVu" else "Helvetica"
    pad = 0.3 * cm
    cur_y = y - pad

    name = (doc.get("name") or "Без названия")[:70]
    c.setFont(font_b, 10)
    c.drawString(x + pad, cur_y - 0.45 * cm, f"{num}. {name}")
    cur_y -= 0.7 * cm

    meta = [p for p in [
        doc.get("rec_date") or "",
        doc.get("rec_type") or "",
        doc.get("rec_amount") or "",
        doc.get("rec_counterparty") or ""
    ] if p]
    if meta:
        c.setFont(font_r, 7)
        c.drawString(x + pad, cur_y - 0.25 * cm, " • ".join(meta)[:90])
        cur_y -= 0.5 * cm

    c.line(x + pad, cur_y, x + slot_w - pad, cur_y)
    cur_y -= 0.2 * cm

    s3_url = doc.get("s3_url") or ""
    if s3_url:
        result = compress_image(s3_url)
        if result:
            img_bytes, img_w, img_h = result
            scale = min((slot_w-2*pad)/img_w, (cur_y-y+slot_h-pad)/img_h, 1.0)
            c.drawImage(ImageReader(io.BytesIO(img_bytes)), x+pad, cur_y-img_h*scale,
                        width=img_w*scale, height=img_h*scale)


def generate_pdf(docs: list) -> bytes:
    from reportlab.pdfgen import canvas as rl_canvas
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import cm

    font = load_font()
    W, H = A4
    margin = 1.2 * cm
    gutter = 0.4 * cm
    slot_h = (H - 2*margin - gutter)/2
    slot_w = W - 2*margin
    max_img_h = slot_h - 1.8*cm

    buf = io.BytesIO()
    c = rl_canvas.Canvas(buf, pagesize=A4)
    now_str = datetime.now().strftime("%d.%m.%Y %H:%M")

    c.setFont("Helvetica-Bold", 18)
    c.drawString(margin, H-margin-0.5*cm, "Список документов")
    c.setFont("Helvetica", 10)
    c.drawString(margin, H-margin-1.3*cm, f"Сформирован: {now_str}")
    c.showPage()

    for i in range(0, len(docs), 2):
        draw_doc_slot(c, docs[i], i+1, margin, H-margin, slot_w, slot_h, font, max_img_h)
        if i+1 < len(docs):
            draw_doc_slot(c, docs[i+1], i+2, margin, H-margin-slot_h-gutter, slot_w, slot_h, font, max_img_h)
        c.showPage()

    c.save()
    return buf.getvalue()


def handler(event: dict, context) -> dict:
    """Генерирует PDF с фото документов, сохраняет в S3."""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    qs = event.get("queryStringParameters") or {}
    ids_param = qs.get("ids", "")

    conn = get_conn()
    cur = conn.cursor()
    try:
        yc = get_yandex_s3_cfg(conn)

        if ids_param:
            id_list = [int(x) for x in ids_param.split(",") if x.isdigit()]
            if not id_list:
                return resp(400, {"error": "Некорректные ids"})
            placeholders = ",".join(["%s"]*len(id_list))
            cur.execute(f"SELECT id, name, s3_url FROM {SCHEMA}.documents WHERE id IN ({placeholders}) AND status='done'", id_list)
        else:
            cur.execute(f"SELECT id, name, s3_url FROM {SCHEMA}.documents WHERE status='done' AND s3_url IS NOT NULL")

        cols = ["id", "name", "s3_url"]
        docs = [dict(zip(cols, row)) for row in cur.fetchall()]
    finally:
        cur.close()
        conn.close()

    if not docs:
        return resp(200, {"ok": False, "error": "Нет документов для генерации PDF"})

    pdf_bytes = generate_pdf(docs)
    filename = f"Dokumenty_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
    url = save_pdf(pdf_bytes, filename, yc)

    return resp(200, {"ok": True, "url": url, "filename": filename, "count": len(docs)})
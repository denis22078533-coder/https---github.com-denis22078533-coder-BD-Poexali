"""
Документы: список, создание записи, обновление распознанных полей, удаление.
GET / — список документов (фильтруется по user_id из токена или session_id)
POST / — создать запись документа (без файла, метаданные)
PUT /?id=N — обновить поля распознавания
DELETE /?id=N — удалить
"""
import json
import os
import psycopg2
import base64
import hashlib
import hmac
from datetime import datetime

SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "t_p79040548_accounting_automatio")
SECRET_KEY = os.environ.get("SECRET_KEY", "your-secret-key-change-it-in-production")
CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Content-Type": "application/json",
}

def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])

def b64url_decode(s: str) -> bytes:
    """Декодирует URL-safe base64 с добавлением паддинга."""
    rem = len(s) % 4
    if rem:
        s += '=' * (4 - rem)
    return base64.urlsafe_b64decode(s)

def verify_jwt(token: str) -> dict | None:
    """Проверяет JWT (HS256) и возвращает payload, или None если невалидный."""
    try:
        parts = token.split('.')
        if len(parts) != 3:
            return None
        header_b64, payload_b64, sig_b64 = parts
        # Проверяем подпись
        message = f"{header_b64}.{payload_b64}".encode('utf-8')
        expected_sig = hmac.new(SECRET_KEY.encode('utf-8'), message, hashlib.sha256).digest()
        # Декодируем сигнатуру
        actual_sig = b64url_decode(sig_b64)
        if not hmac.compare_digest(expected_sig, actual_sig):
            return None
        # Декодируем payload
        payload_bytes = b64url_decode(payload_b64)
        return json.loads(payload_bytes)
    except Exception:
        return None

def get_user_id_from_token(headers: dict, conn, cur) -> int | None:
    """Извлекает user_id из JWT токена (Authorization Bearer)."""
    auth_header = headers.get("authorization") or headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return None
    token = auth_header.split(" ", 1)[1]
    try:
        payload = verify_jwt(token)
        if not payload:
            return None
        email = payload.get("sub")
        if not email:
            return None
        cur.execute(f"SELECT id FROM {SCHEMA}.users WHERE email = %s", (email,))
        row = cur.fetchone()
        return row[0] if row else None
    except Exception:
        return None

def resp(status, body):
    return {"statusCode": status, "headers": CORS, "body": json.dumps(body, ensure_ascii=False, default=str)}

def handler(event: dict, context) -> dict:
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    method = event.get("httpMethod", "GET")
    qs = event.get("queryStringParameters") or {}
    headers = event.get("headers", {}) or {}
    conn = get_conn()
    cur = conn.cursor()
    session_id = qs.get("session_id")  # для гостей можем передавать session_id в query

    try:
        if method == "GET":
            # Определяем user_id через токен
            user_id = get_user_id_from_token(headers, conn, cur)
            
            if user_id:
                # Авторизованный пользователь — его документы
                cur.execute(f"""
                    SELECT d.id, d.name, d.size_label, d.file_key, d.status,
                           d.rec_type, d.rec_amount, d.rec_date, d.rec_counterparty, d.rec_inn,
                           d.created_at, d.s3_url,
                           t.id AS transaction_id, t.category AS rec_category,
                           d.is_cashless
                    FROM {SCHEMA}.documents d
                    LEFT JOIN {SCHEMA}.transactions t
                        ON t.document_id = d.id AND t.status != 'Отменено'
                    WHERE d.user_id = %s
                    ORDER BY d.created_at DESC
                """, (user_id,))
            elif session_id:
                # Гость — его документы по session_id
                cur.execute(f"""
                    SELECT d.id, d.name, d.size_label, d.file_key, d.status,
                           d.rec_type, d.rec_amount, d.rec_date, d.rec_counterparty, d.rec_inn,
                           d.created_at, d.s3_url,
                           t.id AS transaction_id, t.category AS rec_category,
                           d.is_cashless
                    FROM {SCHEMA}.documents d
                    LEFT JOIN {SCHEMA}.transactions t
                        ON t.document_id = d.id AND t.status != 'Отменено'
                    WHERE d.session_id = %s
                    ORDER BY d.created_at DESC
                """, (session_id,))
            else:
                # Никакой идентификации — пустой список
                return resp(200, {"documents": []})

            cols = ["id","name","size_label","file_key","status",
                    "rec_type","rec_amount","rec_date","rec_counterparty","rec_inn",
                    "created_at","s3_url","transaction_id","rec_category","is_cashless"]
            rows = [dict(zip(cols, r)) for r in cur.fetchall()]
            return resp(200, {"documents": rows})

        if method == "POST":
                        body = json.loads(event.get("body") or "{}")
            # Определяем user_id (для авторизованных) и session_id (для гостей)
            user_id = get_user_id_from_token(headers, conn, cur)
            session_id = body.get("session_id")
            if not user_id and not session_id:
                session_id = None  # допустимо для fallback
            cur.execute(f"""
                INSERT INTO {SCHEMA}.documents
                    (user_id, session_id, name, size_label, file_key, status, rec_type, rec_amount, rec_date, rec_counterparty, rec_inn, s3_url, is_cashless)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id, name, size_label, status, s3_url, created_at, is_cashless
            """, (
                user_id,
                session_id if not user_id else None,  # если есть user_id — session_id не пишем
                body.get("name", "document"),
                body.get("size_label"),
                body.get("file_key"),
                body.get("status", "processing"),
                body.get("rec_type"),
                body.get("rec_amount"),
                body.get("rec_date"),
                body.get("rec_counterparty"),
                body.get("rec_inn"),
                body.get("s3_url"),
                body.get("is_cashless", False),
            ))
            conn.commit()
            cols = ["id","name","size_label","status","s3_url","created_at","is_cashless"]
            row = dict(zip(cols, cur.fetchone()))
            return resp(201, {"document": row})

        if method == "PUT":
            doc_id = qs.get("id")
            if not doc_id:
                return resp(400, {"error": "id required"})
            body = json.loads(event.get("body") or "{}")
            fields = []
            params = []
            mapping = {
                "status": "status",
                "rec_type": "rec_type",
                "rec_amount": "rec_amount",
                "rec_date": "rec_date",
                "rec_counterparty": "rec_counterparty",
                "rec_inn": "rec_inn",
                "is_cashless": "is_cashless",
            }
            for k, col in mapping.items():
                if k in body:
                    fields.append(f"{col} = %s")
                    params.append(body[k])
            if not fields:
                return resp(400, {"error": "No fields"})
            params.append(doc_id)
            cur.execute(f"""
                UPDATE {SCHEMA}.documents SET {', '.join(fields)} WHERE id = %s
                RETURNING id, name, size_label, status, rec_type, rec_amount, rec_date, rec_counterparty, rec_inn, is_cashless
            """, params)
            conn.commit()
            row = cur.fetchone()
            if not row:
                return resp(404, {"error": "Not found"})
            cols = ["id","name","size_label","status","rec_type","rec_amount","rec_date","rec_counterparty","rec_inn","is_cashless"]
            doc = dict(zip(cols, row))
            # Синхронизируем is_cashless в связанной транзакции
            if "is_cashless" in body:
                cur.execute(f"UPDATE {SCHEMA}.transactions SET is_cashless = %s WHERE document_id = %s", (body["is_cashless"], doc_id))
                conn.commit()
            return resp(200, {"document": doc})

        if method == "DELETE":
            doc_id = qs.get("id")
            if not doc_id:
                return resp(400, {"error": "id required"})
            # Находим связанную транзакцию до удаления документа
            cur.execute(f"SELECT id FROM {SCHEMA}.transactions WHERE document_id = %s", (doc_id,))
            tx_rows = [r[0] for r in cur.fetchall()]
            # Удаляем документ
            cur.execute(f"DELETE FROM {SCHEMA}.documents WHERE id = %s RETURNING id", (doc_id,))
            if not cur.fetchone():
                conn.commit()
                return resp(404, {"error": "Not found"})
            # Удаляем связанные транзакции
            if tx_rows:
                cur.execute(f"DELETE FROM {SCHEMA}.transactions WHERE id = ANY(%s)", (tx_rows,))
            conn.commit()
            return resp(200, {"ok": True, "deleted_transactions": len(tx_rows)})

        return resp(405, {"error": "Method not allowed"})

    finally:
        cur.close()
        conn.close()
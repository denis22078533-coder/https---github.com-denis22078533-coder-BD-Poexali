#!/bin/bash
apt update && apt install -y git python3-pip
git clone https://github.com/denis22078533-coder/https---github.com-denis22078533-coder-BD-Poexali.git /root/app
cd /root/app/api && pip3 install -r requirements.txt
nohup uvicorn main:app --host 0.0.0.0 --port 8000 > /root/app/fastapi.log 2>&1 &
echo "FastAPI backend is running!"

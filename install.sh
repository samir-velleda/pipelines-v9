#!/bin/bash
set -e
echo "[1/4] Instalando dependencias..."
apt-get update -qq && apt-get install -y -qq python3-pip python3-venv libgl1-mesa-glx libglib2.0-0 curl wget sqlite3
echo "[2/4] Criando ambiente virtual..."
python3 -m venv /root/v9-venv
source /root/v9-venv/bin/activate
echo "[3/4] Instalando dependencias Python..."
pip install --upgrade pip -q
pip install -q flask flask-cors requests numpy opencv-python-headless
pip install -q onnxruntime-gpu 2>/dev/null || pip install -q onnxruntime 2>/dev/null || true
echo "[4/4] Configurando arquivos..."
cp pipeline_blocklist.py /root/pipeline_blocklist.py
cp pipeline_facial.py /root/pipeline_facial.py
cp orchestrator.py /root/orchestrator.py
chmod +x /root/*.py
cat > /root/start_v9.sh << 'EOF'
#!/bin/bash
cd /root
source /root/v9-venv/bin/activate
python3 pipeline_blocklist.py > /tmp/blocklist.log 2>&1 &
BL_PID=$!
sleep 3
python3 pipeline_facial.py > /tmp/facial.log 2>&1 &
FA_PID=$!
sleep 3
python3 orchestrator.py > /tmp/orchestrator.log 2>&1 &
OR_PID=$!
echo "Todos iniciados!"
printf "%s\\n%s\\n%s\\n" "$BL_PID" "$FA_PID" "$OR_PID" > /tmp/v9_pids.txt
EOF
chmod +x /root/start_v9.sh
cat > /root/stop_v9.sh << 'EOF'
#!/bin/bash
if [ -f /tmp/v9_pids.txt ]; then
    while read pid; do kill -9 "$pid" 2>/dev/null || true; done < /tmp/v9_pids.txt
    rm -f /tmp/v9_pids.txt
else
    pkill -f "pipeline_blocklist.py" || true
    pkill -f "pipeline_facial.py" || true
    pkill -f "orchestrator.py" || true
fi
EOF
chmod +x /root/stop_v9.sh
cat > /root/health_v9.sh << 'EOF'
#!/bin/bash
echo "[Block List 8084]"
curl -s http://localhost:8084/health 2>/dev/null || echo "OFFLINE"
echo "[Facial 8087]"
curl -s http://localhost:8087/health 2>/dev/null || echo "OFFLINE"
echo "[Orchestrator 8082]"
curl -s http://localhost:8082/health 2>/dev/null || echo "OFFLINE"
EOF
chmod +x /root/health_v9.sh
echo "Instalacao completa!"
echo "Iniciar: /root/start_v9.sh"
echo "Parar: /root/stop_v9.sh"
echo "Health: /root/health_v9.sh"

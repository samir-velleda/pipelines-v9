# V9 GPU Pipelines

Sistema de reconhecimento facial para lojas.

## Componentes

| Servico | Porta | Funcao |
|---------|-------|--------|
| Block List | 8084 | Banco de faces + busca por similaridade |
| Facial | 8087 | Deteccao de rostos + extracao de embeddings |
| Orchestrator | 8082 | Orquestracao + webhook para frontend |

## Instalacao no RunPod

```bash
git clone https://github.com/samir-velleda/pipelines-v9.git
cd pipelines-v9
bash install.sh
/root/start_v9.sh
```

## Variaveis de Ambiente

| Variavel | Padrao | Descricao |
|----------|--------|-----------|
| BLOCKLIST_PORT | 8084 | Porta do Block List |
| FACIAL_PORT | 8087 | Porta do Facial |
| ORCH_PORT | 8082 | Porta do Orchestrator |
| BLOCKLIST_THRESHOLD | 0.70 | Threshold de match |
| FACIAL_SCORE_THRESHOLD | 0.70 | Threshold de deteccao |
| GPU_WEBHOOK_SECRET | nova-key-webhook-2026 | Secret do webhook |
| WEBHOOK_URL | "" | URL do frontend |

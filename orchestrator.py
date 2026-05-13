#!/usr/bin/env python3
import os,sys,json,time,base64,hashlib,hmac,logging,threading,requests,ssl
from datetime import datetime
from flask import Flask,request,jsonify
from flask_cors import CORS
ssl._create_default_https_context=ssl._create_unverified_context
P=int(os.environ.get("ORCH_PORT",8082))
F=os.environ.get("FACIAL_URL","http://127.0.0.1:8087/process")
W=os.environ.get("WEBHOOK_URL","")
K=os.environ.get("GPU_WEBHOOK_SECRET","nova-key-webhook-2026")
logging.basicConfig(level=logging.INFO,format="%(asctime)s %(message)s",handlers=[logging.FileHandler("/tmp/orch.log"),logging.StreamHandler(sys.stdout)])
l=logging.getLogger("orch")
app=Flask(__name__)
CORS(app)
st={"total":0,"ok":0,"fail":0,"blocked":0,"start":time.time()}
lock=threading.Lock()
def sw(p):
 if not W:return False
 try:
  s=hmac.new(K.encode(),json.dumps(p,sort_keys=True,separators=(",",":")).encode(),hashlib.sha256).hexdigest()
  h={"Content-Type":"application/json","X-Signature":s}
  r=requests.post(W,json=p,headers=h,timeout=15,verify=False)
  return r.status_code in[200,201,202]
 except:return False
def cf(im,ci,si):
 try:
  r=requests.post(F,json={"image":im,"camera_id":ci,"store_id":si,"timestamp":datetime.utcnow().isoformat()},timeout=30,verify=False)
  if r.status_code==200:return r.json()
 except:return None
@app.route("/health",methods=["GET"])
def h():return jsonify({"status":"ok","port":P,"uptime":int(time.time()-st["start"]),"stats":st})
@app.route("/receive",methods=["POST"])
def r():
 try:
  d=request.get_json(force=True);im=d.get("image")or d.get("snapshot");ci=d.get("camera_id",d.get("camera","unk"));si=d.get("store_id","grupomateus")
  with lock:st["total"]+=1
  if not im:
   with lock:st["fail"]+=1
   return jsonify({"error":"no image"}),400
  l.info(f"Receive cam={ci}")
  fr=cf(im,ci,si)
  if fr is None:
   with lock:st["fail"]+=1
   return jsonify({"error":"facial failed"}),500
  tm=fr.get("total_matches",0);ev=fr.get("evento","NO_MATCH");bl=fr.get("blocked",False)
  rp={"occurrence_id":d.get("occurrence_id",""),"pdv_store_id":d.get("pdv_store_id",""),"cashier_id":d.get("cashier_id",""),"action":d.get("action",""),"camera_id":ci,"store_id":si,"timestamp":datetime.utcnow().isoformat(),"evento":ev,"blocked":bl,"total_matches":tm,"faces_detail":fr.get("faces_detail",[]),"matches":[]}
  for fa in fr.get("faces_detail",[]):rp["matches"].extend(fa.get("matches",[]))
  fp={"id":rp["occurrence_id"],"id_loja":rp["pdv_store_id"],"id_caixa":rp["cashier_id"],"without_payment":rp["action"]=="start","camera_id":ci,"timestamp":rp["timestamp"],"evento":ev,"blocked":bl,"total_matches":tm,"faces":rp["faces_detail"],"matches":rp["matches"]}
  ws=sw(fp)
  with lock:st["ok"]+=1
  if bl:st["blocked"]+=1
  return jsonify({"status":"processed","camera_id":ci,"faces":fr.get("faces",0),"matches":tm,"blocked":bl,"evento":ev,"webhook":ws})
 except Exception as e:
  l.error(f"Error:{e}")
  with lock:st["fail"]+=1
  return jsonify({"error":str(e)}),500
@app.route("/process",methods=["POST"])
def pr():return r()
@app.route("/stats",methods=["GET"])
def s():return jsonify({"stats":st})
@app.route("/test-webhook",methods=["POST"])
def tw():
 p={"occurrence_id":"test","pdv_store_id":"96","cashier_id":"c1","action":"start","camera_id":"1013101","store_id":"grupomateus","timestamp":datetime.utcnow().isoformat(),"evento":"TEST","blocked":True,"total_matches":1,"faces_detail":[],"matches":[{"id":1,"name":"Test","score":0.95}]}
 fp={"id":"test","id_loja":"96","id_caixa":"c1","without_payment":True,"camera_id":"1013101","timestamp":p["timestamp"],"evento":"TEST","blocked":True,"total_matches":1,"faces_detail":[],"matches":p["matches"]}
 return jsonify({"sent":sw(fp),"payload":fp})
if __name__=="__main__":
 l.info(f"Orchestrator on port {P}");app.run(host="0.0.0.0",port=P,threaded=True)

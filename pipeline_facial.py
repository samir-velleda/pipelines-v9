#!/usr/bin/env python3
import os,sys,json,time,base64,logging,requests,threading,ssl
from datetime import datetime
from flask import Flask,request,jsonify
from flask_cors import CORS
ssl._create_default_https_context=ssl._create_unverified_context
try:
 import cv2,numpy as np
 CV=True
except:CV=False
try:
 import onnxruntime as ort
 ON=True
except:ON=False
P=int(os.environ.get("FACIAL_PORT",8087))
B=os.environ.get("BLOCKLIST_URL","http://127.0.0.1:8084/search")
S=float(os.environ.get("FACIAL_SCORE_THRESHOLD",0.70))
logging.basicConfig(level=logging.INFO,format="%(asctime)s %(message)s",handlers=[logging.FileHandler("/tmp/facial.log"),logging.StreamHandler(sys.stdout)])
l=logging.getLogger("facial")
app=Flask(__name__)
CORS(app)
class FR:
 def __init__(self,p):
  self.p=p;self.s=None;self.lock=threading.Lock()
  if ON and os.path.exists(p):
   try:self.s=ort.InferenceSession(p,providers=["CUDAExecutionProvider","CPUExecutionProvider"]);l.info("Model loaded")
   except:l.warning("Model failed, simulation mode")
 def detect(self,ib):
  if not CV:return[]
  n=np.frombuffer(ib,np.uint8);i=cv2.imdecode(n,cv2.IMREAD_COLOR)
  if i is None:return[]
  return self._basic(i)
 def _basic(self,img):
  f=[]
  try:
   c=cv2.CascadeClassifier(cv2.data.haarcascades+"haarcascade_frontalface_default.xml")
   g=cv2.cvtColor(img,cv2.COLOR_BGR2GRAY);d=c.detectMultiScale(g,1.1,4)
   for x,y,w,h in d:
    e=np.random.randn(128).astype(np.float32);e=e/(np.linalg.norm(e)+1e-10)
    f.append({"bbox":[int(x),int(y),int(w),int(h)],"score":0.85,"embedding":e.tolist()})
  except:pass
  return f
r=FR("/root/models/face_recognition.onnx")
def cb(e,th=0.70):
 try:
  x=requests.post(B,json={"embedding":e,"threshold":th},timeout=10,verify=False)
  if x.status_code==200:d=x.json();return d.get("matches",[]),d.get("total",0)
  return[],0
 except:return[],0
def proc(im,ci,si,ts=None):
 if ts is None:ts=datetime.utcnow().isoformat()
 try:
  if isinstance(im,str):im=base64.b64decode(im)
  f=r.detect(im);rs=[];tm=0
  for fa in f:
   e=fa.get("embedding")
   if not e:continue
   m,mc=cb(e);tm+=mc
   rs.append({"bbox":fa["bbox"],"score":fa["score"],"embedding":e,"matches":m,"blocked":mc>0})
  ev="BLOCKED" if tm>0 else "NO_MATCH"
  return{"camera_id":ci,"store_id":si,"timestamp":ts,"faces":len(f),"total_matches":tm,"evento":ev,"faces_detail":rs,"blocked":tm>0}
 except Exception as e:return{"camera_id":ci,"store_id":si,"timestamp":ts,"error":str(e),"faces":0,"total_matches":0,"evento":"ERROR","blocked":False}
@app.route("/health",methods=["GET"])
def h():return jsonify({"status":"ok","port":P,"cv2":CV,"onnx":ON,"model":r.s is not None})
@app.route("/process",methods=["POST"])
def p():
 try:
  d=request.get_json(force=True);im=d.get("image");ci=d.get("camera_id","unknown");si=d.get("store_id","grupomateus")
  if not im:return jsonify({"error":"no image"}),400
  return jsonify(proc(im,ci,si))
 except Exception as e:return jsonify({"error":str(e)}),500
if __name__=="__main__":
 l.info(f"Facial on port {P}");app.run(host="0.0.0.0",port=P,threaded=True)

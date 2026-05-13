#!/usr/bin/env python3
import os,sys,json,time,sqlite3,logging,threading,numpy as np
from datetime import datetime
from flask import Flask,request,jsonify
from flask_cors import CORS
P=int(os.environ.get("BLOCKLIST_PORT",8084))
D=os.environ.get("BLOCKLIST_DB","/root/blocklist.db")
T=float(os.environ.get("BLOCKLIST_THRESHOLD",0.70))
logging.basicConfig(level=logging.INFO,format="%(asctime)s %(message)s",handlers=[logging.FileHandler("/tmp/blocklist.log"),logging.StreamHandler(sys.stdout)])
l=logging.getLogger("blocklist")
app=Flask(__name__)
CORS(app)
class DB:
 def __init__(self,p):
  self.p=p;self.lock=threading.Lock();self.cache={};self.last=0
  with sqlite3.connect(p) as c:
   c.execute("CREATE TABLE IF NOT EXISTS faces(id INTEGER PRIMARY KEY,name TEXT,embedding BLOB,metadata TEXT,active INTEGER DEFAULT 1)")
   c.commit()
  self.sync()
 def sync(self):
  with self.lock:
   with sqlite3.connect(self.p) as c:
    r=c.execute("SELECT id,name,embedding,metadata FROM faces WHERE active=1").fetchall()
    self.cache={}
    for i,n,e,m in r:
     self.cache[i]={"id":i,"name":n,"embedding":np.frombuffer(e,dtype=np.float32),"metadata":json.loads(m)if m else{}}
    self.last=time.time();l.info(f"Sync:{len(self.cache)}faces")
 def search(self,emb,th=None):
  if th is None:th=T
  if time.time()-self.last>30:self.sync()
  if not self.cache:return[]
  q=np.array(emb,dtype=np.float32);qn=q/(np.linalg.norm(q)+1e-10)
  matches=[]
  with self.lock:
   for i,f in self.cache.items():
    en=f["embedding"]/(np.linalg.norm(f["embedding"])+1e-10)
    sc=max(0.0,1.0-np.linalg.norm(qn-en))
    if sc>=th:matches.append({"id":i,"name":f["name"],"score":float(sc)})
  matches.sort(key=lambda x:x["score"],reverse=True)
  return matches
 def add(self,name,emb,meta=None):
  with self.lock:
   b=np.array(emb,dtype=np.float32).tobytes();m=json.dumps(meta)if meta else None
   with sqlite3.connect(self.p) as c:
    i=c.execute("INSERT INTO faces(name,embedding,metadata)VALUES(?,?,?)",(name,b,m)).lastrowid;c.commit()
   self.cache[i]={"id":i,"name":name,"embedding":np.array(emb,dtype=np.float32),"metadata":meta or{}}
   l.info(f"Added:{name}({i})");return{"success":True,"id":i}
db=DB(D)
@app.route("/health",methods=["GET"])
def h():return jsonify({"status":"ok","port":P,"faces":len(db.cache)})
@app.route("/search",methods=["POST"])
def s():
 try:
  r=request.get_json(force=True);e=r.get("embedding");th=r.get("threshold",T)
  if not e:return jsonify({"error":"no embedding"}),400
  return jsonify({"matches":db.search(e,th),"total":len(db.search(e,th))})
 except Exception as e:return jsonify({"error":str(e)}),500
@app.route("/add",methods=["POST"])
def a():
 try:
  r=request.get_json(force=True);n=r.get("name");e=r.get("embedding")
  if not n or not e:return jsonify({"error":"name+embedding required"}),400
  return jsonify(db.add(n,e,r.get("metadata")))
 except Exception as e:return jsonify({"error":str(e)}),500
if __name__=="__main__":
 l.info(f"Block List on port {P}");app.run(host="0.0.0.0",port=P,threaded=True)

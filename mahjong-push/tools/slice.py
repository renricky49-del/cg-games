# Slices AI item sheets (store/raw/itemsN.png) into 5 sprites each -> assets/img/items/aN_k.png
# Components are found on a downscaled alpha mask, then merged until 5 clusters remain,
# ordered in reading order (row by row).
import numpy as np, os, sys
from PIL import Image
os.makedirs('assets/img/items', exist_ok=True)
def label(mask):
    h,w=mask.shape; lab=np.zeros((h,w),int); n=0
    for y in range(h):
        for x in range(w):
            if mask[y,x] and not lab[y,x]:
                n+=1; st=[(y,x)]; lab[y,x]=n
                while st:
                    cy,cx=st.pop()
                    for dy in (-1,0,1):
                        for dx in (-1,0,1):
                            yy,xx=cy+dy,cx+dx
                            if 0<=yy<h and 0<=xx<w and mask[yy,xx] and not lab[yy,xx]:
                                lab[yy,xx]=n; st.append((yy,xx))
    return lab,n
import sys
# usage: python3 tools/slice.py [sheet_numbers...]  (default 1-5); mascot: python3 tools/slice.py mascot
args=sys.argv[1:] or ['1','2','3','4','5']
for s in args:
    src=f'store/raw/items{s}.png' if s.isdigit() else f'store/raw/{s}.png'
    N=5 if s.isdigit() else 3
    im=Image.open(src).convert('RGBA')
    a=np.array(im)[:,:,3]
    F=8; h,w=a.shape[0]//F,a.shape[1]//F
    small=a[:h*F,:w*F].reshape(h,F,w,F).max(axis=(1,3))>40
    lab,n=label(small)
    boxes=[]
    for k in range(1,n+1):
        ys,xs=np.where(lab==k)
        boxes.append([xs.min(),ys.min(),xs.max()+1,ys.max()+1,len(xs)])
    boxes=[b for b in boxes if b[4]>=3]
    def gap(a,b):
        dx=max(0,max(a[0],b[0])-min(a[2],b[2])); dy=max(0,max(a[1],b[1])-min(a[3],b[3])); return max(dx,dy)
    while len(boxes)>N:
        i=min(range(len(boxes)),key=lambda i:boxes[i][4])
        j=min((j for j in range(len(boxes)) if j!=i),key=lambda j:gap(boxes[i],boxes[j]))
        a1,b1=boxes[i],boxes[j]
        boxes[j]=[min(a1[0],b1[0]),min(a1[1],b1[1]),max(a1[2],b1[2]),max(a1[3],b1[3]),a1[4]+b1[4]]
        boxes.pop(i)
    # reading order: rows by centre y
    boxes.sort(key=lambda b:(b[1]+b[3])/2)
    top=sorted(boxes[:3],key=lambda b:b[0]); bot=sorted(boxes[3:],key=lambda b:b[0])
    if N==3: top=sorted(boxes,key=lambda b:b[0]); bot=[]
    for k,b in enumerate(top+bot):
        x0,y0,x1,y1=[v*F for v in b[:4]]
        crop=im.crop((max(0,x0-4),max(0,y0-4),min(im.width,x1+4),min(im.height,y1+4)))
        bb=crop.getbbox(); crop=crop.crop(bb)
        # cap to 420px max dimension (displayed ~200px, x2 retina)
        cap=900 if s=='uikit' else 420
        sc=min(1,cap/max(crop.size)); crop=crop.resize((max(1,int(crop.width*sc)),max(1,int(crop.height*sc))),Image.LANCZOS)
        q=crop.quantize(colors=200,method=Image.FASTOCTREE,dither=Image.FLOYDSTEINBERG) if False else crop
        out=(f'assets/img/items/a{s}_{k}.webp' if s.isdigit() else f'assets/img/{s}_{k}.webp'); q.save(out,'WEBP',quality=82,method=6)
        print(out,crop.size,os.path.getsize(out)//1024,'KB')

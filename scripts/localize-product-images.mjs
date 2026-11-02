import fs from 'node:fs';
import path from 'node:path';

const productsPath='dist/data/products.json';
const outputDir='dist/assets/products';
const imageWidth=480;
const products=JSON.parse(fs.readFileSync(productsPath,'utf8'));
fs.mkdirSync(outputDir,{recursive:true});

const extensionFor=(type,url)=>{
  if(/png/i.test(type))return 'png';
  if(/webp/i.test(type))return 'webp';
  if(/gif/i.test(type))return 'gif';
  const match=new URL(url).pathname.match(/\.(jpe?g|png|webp|gif)$/i);
  return match?match[1].toLowerCase().replace('jpeg','jpg'):'jpg';
};
const fetchImage=async(url)=>{
  const candidates=[`${url}${url.includes('?')?'&':'?'}width=${imageWidth}`,url];
  let lastError;
  for(const candidate of candidates){
    for(let attempt=0;attempt<3;attempt++){
      try{
        const response=await fetch(candidate,{headers:{'User-Agent':'Mozilla/5.0','Accept':'image/avif,image/webp,image/apng,image/*,*/*;q=0.8'}});
        const type=response.headers.get('content-type')||'';
        if(!response.ok||!type.startsWith('image/'))throw new Error(`HTTP ${response.status} ${type}`);
        const bytes=Buffer.from(await response.arrayBuffer());
        if(bytes.length<1000)throw new Error(`Image too small: ${bytes.length}`);
        return {bytes,type,url:candidate};
      }catch(error){lastError=error;await new Promise(resolve=>setTimeout(resolve,250*(attempt+1)));}
    }
  }
  throw lastError;
};

let cursor=0,completed=0;
const failures=[];
const worker=async()=>{
  while(true){
    const index=cursor++;
    if(index>=products.length)return;
    const product=products[index];
    const source=product.sourceImageUrl||product.imageUrl;
    try{
      if(!source||!/^https:\/\//i.test(source))throw new Error('No public source image URL');
      const image=await fetchImage(source);
      const ext=extensionFor(image.type,source);
      const fileName=`${product.id.replace(/[^a-z0-9-]/gi,'-')}.${ext}`;
      const filePath=path.join(outputDir,fileName);
      fs.writeFileSync(filePath,image.bytes);
      product.sourceImageUrl=source;
      product.imageUrl=`/assets/products/${fileName}`;
      product.localizedImageBytes=image.bytes.length;
      completed++;
      if(completed%50===0)console.log(`Localized ${completed}/${products.length}`);
    }catch(error){failures.push({id:product.id,name:product.name,url:source,error:error.message});}
  }
};
await Promise.all(Array.from({length:16},worker));
fs.writeFileSync(productsPath,JSON.stringify(products,null,2)+'\n');
const files=fs.readdirSync(outputDir).filter(name=>/\.(jpg|jpeg|png|webp|gif)$/i.test(name));
const report={generatedAt:new Date().toISOString(),requestedWidth:imageWidth,products:products.length,localized:completed,failures:failures.length,localFiles:files.length,totalBytes:files.reduce((sum,name)=>sum+fs.statSync(path.join(outputDir,name)).size,0),failureDetails:failures};
fs.writeFileSync('image-localization-report.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
if(failures.length)process.exitCode=2;



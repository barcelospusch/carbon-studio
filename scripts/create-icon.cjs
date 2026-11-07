'use strict';
const {app,nativeImage}=require('electron'),fs=require('node:fs'),path=require('node:path');
app.whenReady().then(()=>{
const directory=path.resolve(__dirname,'../build');fs.mkdirSync(directory,{recursive:true});
const original=nativeImage.createFromPath(path.resolve(__dirname,'../logo.png'));if(original.isEmpty())throw new Error('Logo inválido.');
const png=original.resize({width:256,height:256,quality:'best'}).toPNG();const header=Buffer.alloc(22);header.writeUInt16LE(1,2);header.writeUInt16LE(1,4);header.writeUInt16LE(1,10);header.writeUInt16LE(32,12);header.writeUInt32LE(png.length,14);header.writeUInt32LE(22,18);
fs.writeFileSync(path.join(directory,'icon.png'),png);fs.writeFileSync(path.join(directory,'icon.ico'),Buffer.concat([header,png]));app.quit();
}).catch(error=>{console.error(error);app.exit(1);});

export async function shellReady():Promise<boolean>{
 if(!('serviceWorker' in navigator))return false;
 const worker=navigator.serviceWorker.controller;if(!worker)return false;
 return new Promise(resolve=>{const channel=new MessageChannel();const timer=setTimeout(()=>{channel.port1.close();resolve(false);},2500);channel.port1.onmessage=e=>{clearTimeout(timer);channel.port1.close();resolve(e.data?.ready===true);};worker.postMessage({type:'CHECK_SHELL'},[channel.port2]);});
}

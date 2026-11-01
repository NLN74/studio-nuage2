// Keep only the public widget identifier; pasted HTML is never stored or executed.
export function widgetIdFrom(value){
 const raw=String(value||'').trim();if(!raw)return '';
 const match=raw.match(/\bdata-eversports-widget-id\s*=\s*(["'])([\w-]{1,100})\1/i);
 const id=match?match[2]:raw;
 if(!/^[\w-]{1,100}$/.test(id))throw Error('Collez le code d’intégration Eversports ou son identifiant.');
 return id;
}

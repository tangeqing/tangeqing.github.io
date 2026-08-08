(function(){
  'use strict';const M=window.GAT,KEY='gat-presets-v1';
  const read=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch(_){return {}}};
  const write=data=>{try{localStorage.setItem(KEY,JSON.stringify(data))}catch(e){throw new Error('无法保存方案：浏览器本地存储空间不足或已禁用。')}};
  M.Presets={
    list(){return read()},
    save(name,data){if(!name.trim())throw new Error('请输入方案名称。');const all=read();all[name.trim()]={...data,savedAt:new Date().toISOString()};write(all);},
    load(name){return read()[name]||null},
    remove(name){const all=read();delete all[name];write(all)},
    rename(oldName,newName){const all=read();if(!all[oldName])throw new Error('找不到要重命名的方案。');if(!newName.trim())throw new Error('新名称不能为空。');all[newName.trim()]=all[oldName];delete all[oldName];write(all)},
    validate(data){if(!data||typeof data!=='object'||!data.settings)throw new Error('JSON 不是有效的练习方案。');return data;}
  };
})();

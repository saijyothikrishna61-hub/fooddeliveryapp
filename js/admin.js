const escAdmin=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const adminTab=()=>new URLSearchParams(location.search).get('tab')||'overview';
const adminTabs=[['overview','Overview'],['users','Users'],['restaurants','Restaurants'],['menu','Menu'],['orders','Orders']];
const adminNav=()=>`<div class="tabs mt admin-tabs">${adminTabs.map(([id,label])=>`<a class="btn ${adminTab()==id?'':'ghost'} sm" href="${L('admin-dashboard.html'+(id=='overview'?'':'?tab='+id))}">${label}</a>`).join('')}</div>`;
const nextId=a=>Math.max(0,...a.map(x=>+x.id||0))+1;

function adminModalForm(title,fields,values,defaults,save){
  const fieldHtml=fields.map(f=>{
    let v=values?.[f.name]??defaults?.[f.name]??f.default??'';
    if(f.type=='checkbox')return `<label class="row admin-check"><input id="ad-${f.name}" type=checkbox ${v?'checked':''}> ${f.label}</label>`;
    if(f.type=='select')return `<label>${f.label}</label><select id="ad-${f.name}">${f.options.map(x=>`<option value="${escAdmin(x)}" ${x==v?'selected':''}>${escAdmin(x)}</option>`).join('')}</select>`;
    return f.type=='textarea'?`<label>${f.label}</label><textarea id="ad-${f.name}" rows=3>${escAdmin(v)}</textarea>`:`<label>${f.label}</label><input id="ad-${f.name}" ${f.type=='number'?'type=number min=0 step=any':f.type=='email'?'type=email':f.type=='password'?'type=password':''} value="${escAdmin(v)}">`
  }).join('');
  modal(`<h3>${title}</h3><form id=admin-edit>${fieldHtml}<div class="row end mt"><button type=button class="btn ghost" onclick="closeModal()">Cancel</button><button class=btn>Save changes</button></div></form>`);
  $('#admin-edit').onsubmit=e=>{
    e.preventDefault();
    const data={};
    fields.forEach(f=>data[f.name]=f.type=='checkbox'?$('#ad-'+f.name).checked:$('#ad-'+f.name).value.trim());
    const err=save(data);
    if(err)return toast(err,'bad');
    closeModal();toast('Changes saved');redraw()
  }
}

function userEdit(u){
  adminModalForm(u?'Edit user':'Add user',[
    {name:'name',label:'Full name'},{name:'email',label:'Email',type:'email'},
    {name:'mobile',label:'Mobile'},{name:'role',label:'Role',type:'select',options:['customer','owner','admin']},
    {name:'pass',label:u?'Password (leave unchanged to keep it)':'Temporary password',type:'password'}
  ],u,{name:'',role:'customer',pass:'customer123'},v=>{
    if(!v.name||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email))return 'Enter a name and valid email';
    const users=S.get('users'),old=u?.email.toLowerCase(),email=v.email.toLowerCase();
    if(users.some(x=>x.email.toLowerCase()==email&&x.email.toLowerCase()!=old))return 'That email is already in use';
    if(u?.role=='admin'&&v.role!='admin'&&users.filter(x=>x.role=='admin'&&!x.disabled).length<=1)return 'Keep at least one active admin account';
    if(u){const oldPass=u.pass;Object.assign(u,v,{email});if(!v.pass)u.pass=oldPass;if(old!=email){S.set('orders',S.get('orders').map(o=>o.email==old?{...o,email}:o));if(me()?.email==old)S.set('session',{...me(),email,name:v.name})}}
    else {if(v.pass.length<6)return 'Temporary password must be at least 6 characters';users.push({...v,email,addresses:[],disabled:false});}
    S.set('users',users)
  });
  if(u)$('#ad-pass').value='';
}

function restaurantEdit(r){
  adminModalForm(r?'Edit restaurant':'Add restaurant',[
    {name:'name',label:'Restaurant name'},{name:'cuisine',label:'Cuisine'},
    {name:'address',label:'Address'},{name:'phone',label:'Phone'},
    {name:'email',label:'Contact email',type:'email'},
    {name:'rating',label:'Rating (0–5)',type:'number'},
    {name:'fee',label:'Delivery fee (₹)',type:'number'},
    {name:'time',label:'Delivery time',default:'25-35'},
    {name:'active',label:'Visible to customers',type:'checkbox'}
  ],r,{rating:4,fee:30,active:true},v=>{
    if(!v.name||!v.cuisine)return 'Restaurant name and cuisine are required';
    const rs=S.get('restaurants');
    if(r)Object.assign(r,v,{rating:+v.rating,fee:+v.fee});
    else rs.push({id:nextId(rs),...v,rating:+v.rating,fee:+v.fee,reviews:0,dist:2,price:2,veg:0,offer:'',img:'restaurant-1',about:`${v.name} serves ${v.cuisine}.`,minOrder:100,open:'10:00',close:'23:00'});
    S.set('restaurants',rs)
  });
}

function foodEdit(f){
  adminModalForm(f?'Edit menu item':'Add menu item',[
    {name:'name',label:'Food name'},{name:'cat',label:'Category',type:'select',options:[...new Set([...CATS,'North Indian','Desserts','Healthy','Drinks','Fast Food'])]},
    {name:'rid',label:'Restaurant',type:'select',options:S.get('restaurants').map(r=>`${r.id} — ${r.name}`)},
    {name:'mrp',label:'Price (₹)',type:'number'},{name:'disc',label:'Discount (%)',type:'number'},
    {name:'desc',label:'Description',type:'textarea'},
    {name:'veg',label:'Vegetarian',type:'checkbox'},{name:'avail',label:'Available to order',type:'checkbox'}
  ],f?{...f,rid:`${f.rid} — ${rest(f.rid)?.name||'Restaurant'}`}:{rid:S.get('restaurants').length?`${S.get('restaurants')[0].id} — ${S.get('restaurants')[0].name}`:'',mrp:100,disc:0,veg:true,avail:true},v=>{
    if(!v.name||!v.mrp||!v.rid)return 'Name, restaurant and a price above zero are required';
    const rid=+v.rid.split(' — ')[0],foods=S.get('foods');
    const data={...v,rid,mrp:+v.mrp,disc:Math.min(100,+v.disc||0),veg:+v.veg,rating:f?.rating||4.5,prep:f?.prep||20};
    if(f)Object.assign(f,data);else foods.push({id:nextId(foods),...data});
    S.set('foods',foods)
  });
}

PAGES['admin-dashboard']={
  role:'admin',title:'Admin',
  render(){
    const tab=adminTab(),users=S.get('users'),rs=S.get('restaurants'),foods=S.get('foods'),orders=S.get('orders');
    let body='';
    if(tab=='overview'){
      const revenue=orders.filter(o=>o.st!=6).reduce((a,o)=>a+o.total,0),pending=orders.filter(o=>o.st==0).length;
      body=`<h1>Platform overview</h1><p class=muted>Manage customers, restaurants, menu listings and incoming orders.</p><div class=stats>${[['👥','Customers',users.filter(u=>u.role=='customer').length],['🏪','Restaurants',rs.filter(r=>r.active!==false).length],['🍽️','Menu items',foods.length],['📦','All orders',orders.length],['⏳','Pending orders',pending],['₹','Gross order value',inr(revenue)]].map(([i,l,v])=>`<div class="card stat"><div class=ic>${i}</div><div><span class=muted>${l}</span><b>${v}</b></div></div>`).join('')}</div><div class="card mt"><div class="row between"><div><h3>Latest orders</h3><p class=muted>Recent activity across all restaurants</p></div><a class="btn ghost sm" href="${L('admin-dashboard.html?tab=orders')}">View all orders</a></div>${orderTable(orders.slice().sort((a,b)=>new Date(b.time)-new Date(a.time)).slice(0,5))}</div>`
    } else if(tab=='users'){
      body=`<div class="row between"><div><h1>Users</h1><p class=muted>Manage customer, owner and admin accounts.</p></div><button class=btn id=add-user>+ Add user</button></div><div class="card mt"><div class=admin-filters><input id=admin-search placeholder="Search name, email or phone..."><select id=role-filter><option value="">All roles</option><option>customer</option><option>owner</option><option>admin</option></select></div><div id=users-table></div></div>`
    } else if(tab=='restaurants'){
      body=`<div class="row between"><div><h1>Restaurants</h1><p class=muted>Control restaurant details and customer visibility.</p></div><button class=btn id=add-restaurant>+ Add restaurant</button></div><div class="card mt tw"><table class=rt><thead><tr><th>Restaurant<th>Cuisine<th>Contact<th>Orders<th>Visibility<th>Actions</tr></thead><tbody>${rs.map(r=>`<tr><td data-label=Restaurant><b>${escAdmin(r.name)}</b><br><small class=muted>${escAdmin(r.address||'')}</small><td data-label=Cuisine>${escAdmin(r.cuisine)}<td data-label=Contact>${escAdmin(r.email||'')}<br>${escAdmin(r.phone||'')}<td data-label=Orders>${orders.filter(o=>o.rid==r.id).length}<td data-label=Visibility><span class="badge ${r.active===false?'s6':'s5'}">${r.active===false?'Hidden':'Visible'}</span><td data-label=Actions><div class=row><button class="btn ghost sm" data-edit-rest="${r.id}">Edit</button><button class="btn sm" data-toggle-rest="${r.id}">${r.active===false?'Show':'Hide'}</button><button class="btn red sm" data-del-rest="${r.id}">Delete</button></div></tr>`).join('')}</tbody></table></div>`
    } else if(tab=='menu'){
      body=`<div class="row between"><div><h1>Menu management</h1><p class=muted>Add and update dishes across restaurants.</p></div><button class=btn id=add-food>+ Add menu item</button></div><div class="card mt"><div class=admin-filters><input id=admin-search placeholder="Search dish or category..."><select id=restaurant-filter><option value="">All restaurants</option>${rs.map(r=>`<option value="${r.id}">${escAdmin(r.name)}</option>`).join('')}</select></div><div id=foods-table></div></div>`
    } else if(tab=='orders'){
      body=`<h1>Order management</h1><p class=muted>Review orders from every restaurant and update their status.</p><div class="card mt"><div class=admin-filters><input id=admin-search placeholder="Search order, customer or restaurant..."><select id=status-filter><option value="">All statuses</option>${ST.map((s,i)=>`<option value="${i}">${s}</option>`).join('')}</select></div><div id=orders-table>${orderTable(orders)}</div></div>`
    } else body=`<h1>Not found</h1>`;
    return adminNav()+body
  },
  init(){
    const tab=adminTab();
    if(tab=='users'){
      const draw=()=>{const q=$('#admin-search').value.toLowerCase(),role=$('#role-filter').value,us=S.get('users').filter(u=>(!role||u.role==role)&&[u.name,u.email,u.mobile].join(' ').toLowerCase().includes(q));$('#users-table').innerHTML=`<div class=tw><table class=rt><thead><tr><th>Name<th>Email<th>Phone<th>Role<th>Account<th>Actions</tr></thead><tbody>${us.map(u=>`<tr><td data-label=Name><b>${escAdmin(u.name)}</b><td data-label=Email>${escAdmin(u.email)}<td data-label=Phone>${escAdmin(u.mobile||'—')}<td data-label=Role><span class=badge>${escAdmin(u.role)}</span><td data-label=Account><span class="badge ${u.disabled?'s6':'s5'}">${u.disabled?'Blocked':'Active'}</span><td data-label=Actions><div class=row><button class="btn ghost sm" data-edit-user="${escAdmin(u.email)}">Edit</button>${u.role!='admin'?`<button class="btn sm" data-block-user="${escAdmin(u.email)}">${u.disabled?'Unblock':'Block'}</button><button class="btn red sm" data-del-user="${escAdmin(u.email)}">Delete</button>`:''}</div></tr>`).join('')}</tbody></table></div>`};draw();$('#admin-search').oninput=draw;$('#role-filter').onchange=draw;$('#add-user').onclick=()=>userEdit(null)
    }
    if(tab=='restaurants')$('#add-restaurant').onclick=()=>restaurantEdit(null);
    if(tab=='menu'){
      const draw=()=>{const q=$('#admin-search').value.toLowerCase(),rid=$('#restaurant-filter').value,fs=S.get('foods').filter(f=>(!rid||f.rid==rid)&&[f.name,f.cat,rest(f.rid)?.name].join(' ').toLowerCase().includes(q));$('#foods-table').innerHTML=`<div class=tw><table class=rt><thead><tr><th>Dish<th>Restaurant<th>Category<th>Price<th>Availability<th>Actions</tr></thead><tbody>${fs.map(f=>`<tr><td data-label=Dish><b>${escAdmin(f.name)}</b><td data-label=Restaurant>${escAdmin(rest(f.rid)?.name||'Unknown')}<td data-label=Category>${escAdmin(f.cat)}<td data-label=Price>${inr(sell(f))}<td data-label=Availability><span class="badge ${f.avail?'s5':'s6'}">${f.avail?'Available':'Hidden'}</span><td data-label=Actions><div class=row><button class="btn ghost sm" data-edit-food="${f.id}">Edit</button><button class="btn sm" data-toggle-food="${f.id}">${f.avail?'Disable':'Enable'}</button><button class="btn red sm" data-del-food="${f.id}">Delete</button></div></tr>`).join('')}</tbody></table></div>`};draw();$('#admin-search').oninput=draw;$('#restaurant-filter').onchange=draw;$('#add-food').onclick=()=>foodEdit(null)
    }
    if(tab=='orders'){
      const draw=()=>{const q=$('#admin-search').value.toLowerCase(),st=$('#status-filter').value,os=S.get('orders').filter(o=>(st===''||o.st==st)&&[o.id,o.cust,rest(o.rid)?.name].join(' ').toLowerCase().includes(q)).sort((a,b)=>new Date(b.time)-new Date(a.time));$('#orders-table').innerHTML=orderTable(os)};$('#admin-search').oninput=draw;$('#status-filter').onchange=draw
    }
  }
};

function orderTable(os){
  return `<div class=tw><table class=rt><thead><tr><th>Order<th>Customer / restaurant<th>Items<th>Total<th>Placed<th>Status<th>Update</tr></thead><tbody>${os.map(o=>`<tr><td data-label=Order><b>#${escAdmin(o.id)}</b><td data-label=Customer>${escAdmin(o.cust)}<br><small class=muted>${escAdmin(rest(o.rid)?.name||'')}</small><td data-label=Items>${o.items.map(i=>`${escAdmin(i.name)} ×${i.q}`).join(', ')}<td data-label=Total>${inr(o.total)}<td data-label=Placed>${new Date(o.time).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'})}<td data-label=Status><span class="badge s${o.st}">${ST[o.st]}</span><td data-label=Update><select data-order-status="${escAdmin(o.id)}">${ST.map((s,i)=>`<option value="${i}" ${o.st==i?'selected':''}>${s}</option>`).join('')}</select></tr>`).join('')||'<tr><td colspan=7 class=muted>No matching orders.</td></tr>'}</tbody></table></div>`
}

document.addEventListener('change',e=>{
  const sel=e.target.closest('[data-order-status]');if(!sel)return;
  setStatus(sel.dataset.orderStatus,+sel.value);toast('Order status updated');redraw()
});
document.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;
  const id=b.dataset;
  if(id.editUser){const u=S.get('users').find(x=>x.email==id.editUser);if(u)userEdit(u)}
  if(id.blockUser){const us=S.get('users'),u=us.find(x=>x.email==id.blockUser);if(u){if(u.role=='admin'&&!u.disabled&&us.filter(x=>x.role=='admin'&&!x.disabled).length<=1)return toast('Keep at least one active admin account','bad');u.disabled=!u.disabled;S.set('users',us);toast(u.disabled?'Account blocked':'Account unblocked');redraw()}}
  if(id.delUser)confirmBox('Delete this account and its order history?',()=>{S.set('users',S.get('users').filter(x=>x.email!=id.delUser));S.set('orders',S.get('orders').filter(x=>x.email!=id.delUser));toast('Account deleted');redraw()});
  if(id.editRest){const r=rest(+id.editRest);if(r)restaurantEdit(r)}
  if(id.toggleRest){const r=rest(+id.toggleRest);if(r){r.active=r.active===false;S.set('restaurants',S.get('restaurants'));toast(r.active?'Restaurant visible':'Restaurant hidden');redraw()}}
  if(id.delRest){const rid=+id.delRest;if(S.get('orders').some(o=>o.rid==rid))toast('This restaurant has order history. Hide it instead of deleting it.','bad');else confirmBox('Delete this restaurant and its menu items?',()=>{S.set('restaurants',S.get('restaurants').filter(x=>x.id!=rid));S.set('foods',S.get('foods').filter(x=>x.rid!=rid));toast('Restaurant deleted');redraw()})}
  if(id.addRestaurant)restaurantEdit(null);
  if(id.editFood){const f=foodById(+id.editFood);if(f)foodEdit(f)}
  if(id.toggleFood){const fs=S.get('foods'),f=fs.find(x=>x.id==id.toggleFood);if(f){f.avail=!f.avail;S.set('foods',fs);toast(f.avail?'Menu item enabled':'Menu item disabled');redraw()}}
  if(id.delFood)confirmBox('Delete this menu item?',()=>{S.set('foods',S.get('foods').filter(x=>x.id!=id.delFood));toast('Menu item deleted');redraw()});
  if(id.addFood)foodEdit(null)
});

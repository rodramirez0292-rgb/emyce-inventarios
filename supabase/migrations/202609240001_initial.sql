-- EMYCE: apply once to a fresh Supabase project. No service key in the application.
create extension if not exists pgcrypto;
create table public.profiles(id uuid primary key references auth.users(id),full_name text not null,role text not null default 'counter' check(role in ('admin','supervisor','counter')),active boolean not null default false,created_at timestamptz not null default now());
create table public.locations(id uuid primary key default gen_random_uuid(),name text not null check(length(trim(name))>0),active boolean not null default true);
create unique index locations_name on public.locations(lower(name));
create table public.products(id uuid primary key default gen_random_uuid(),sku text not null check(length(trim(sku))>0),name text not null check(length(trim(name))>0),description text not null default '',brand text not null default '',category text not null default '',barcode text not null default '',supplier_code text not null default '',serialized boolean not null default false,photo_url text not null default '',active boolean not null default true,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create unique index products_sku on public.products(upper(sku));
create table public.product_barcodes(id uuid primary key default gen_random_uuid(),product_id uuid not null references public.products(id),barcode text not null unique check(length(trim(barcode))>0),barcode_type text not null default 'AUTO',is_primary boolean not null default false);
create index barcodes_product on public.product_barcodes(product_id);
create unique index barcode_primary on public.product_barcodes(product_id) where is_primary;
create table public.inventory_sessions(id uuid primary key default gen_random_uuid(),name text not null check(length(trim(name))>0),location_id uuid not null references public.locations(id),user_id uuid not null references public.profiles(id),started_at timestamptz not null default now(),completed_at timestamptz,status text not null default 'draft' check(status in ('draft','counting','recount','review','completed')));
create index sessions_owner on public.inventory_sessions(user_id,location_id);
create table public.session_products(id uuid primary key default gen_random_uuid(),inventory_session_id uuid not null references public.inventory_sessions(id),product_id uuid not null references public.products(id),recount_required boolean not null default false,unique(inventory_session_id,product_id));
create table public.inventory_counts(id uuid primary key default gen_random_uuid(),inventory_session_id uuid not null references public.inventory_sessions(id),product_id uuid not null references public.products(id),location_id uuid not null references public.locations(id),quantity integer not null check(quantity between 0 and 1000000),user_id uuid not null references public.profiles(id),count_number integer not null check(count_number in (1,2)),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(inventory_session_id,product_id,count_number));
create function public.normalize_serial(value text) returns text language sql immutable strict parallel safe as $$ select regexp_replace(upper(normalize(value,NFKC)),U&'[\0009\000a\000b\000c\000d\0020\00a0\00ad\058a\05be\0600\0601\0602\0603\0604\0605\061c\06dd\070f\0890\0891\08e2\1400\1680\1806\180e\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200a\200b\200c\200d\200e\200f\2010\2011\2012\2013\2014\2015\2028\2029\202a\202b\202c\202d\202e\202f\205f\2060\2061\2062\2063\2064\2066\2067\2068\2069\206a\206b\206c\206d\206e\206f\2e17\2e1a\2e3a\2e3b\2e40\2e5d\3000\301c\3030\30a0\fe31\fe32\fe58\fe63\feff\ff0d\fff9\fffa\fffb\+010d6e\+010ead\+0110bd\+0110cd\+013430\+013431\+013432\+013433\+013434\+013435\+013436\+013437\+013438\+013439\+01343a\+01343b\+01343c\+01343d\+01343e\+01343f\+01bca0\+01bca1\+01bca2\+01bca3\+01d173\+01d174\+01d175\+01d176\+01d177\+01d178\+01d179\+01d17a\+0e0001\+0e0020\+0e0021\+0e0022\+0e0023\+0e0024\+0e0025\+0e0026\+0e0027\+0e0028\+0e0029\+0e002a\+0e002b\+0e002c\+0e002d\+0e002e\+0e002f\+0e0030\+0e0031\+0e0032\+0e0033\+0e0034\+0e0035\+0e0036\+0e0037\+0e0038\+0e0039\+0e003a\+0e003b\+0e003c\+0e003d\+0e003e\+0e003f\+0e0040\+0e0041\+0e0042\+0e0043\+0e0044\+0e0045\+0e0046\+0e0047\+0e0048\+0e0049\+0e004a\+0e004b\+0e004c\+0e004d\+0e004e\+0e004f\+0e0050\+0e0051\+0e0052\+0e0053\+0e0054\+0e0055\+0e0056\+0e0057\+0e0058\+0e0059\+0e005a\+0e005b\+0e005c\+0e005d\+0e005e\+0e005f\+0e0060\+0e0061\+0e0062\+0e0063\+0e0064\+0e0065\+0e0066\+0e0067\+0e0068\+0e0069\+0e006a\+0e006b\+0e006c\+0e006d\+0e006e\+0e006f\+0e0070\+0e0071\+0e0072\+0e0073\+0e0074\+0e0075\+0e0076\+0e0077\+0e0078\+0e0079\+0e007a\+0e007b\+0e007c\+0e007d\+0e007e\+0e007f-]','','g') $$;
create table public.inventory_serial_units(id uuid primary key default gen_random_uuid(),inventory_session_id uuid not null references public.inventory_sessions(id),product_id uuid not null references public.products(id),location_id uuid not null references public.locations(id),serial_number_original text not null,serial_number_normalized text generated always as (public.normalize_serial(serial_number_original)) stored,serial_number text generated always as (public.normalize_serial(serial_number_original)) stored,serial_barcode text not null default '',photo_url text not null default '',user_id uuid not null references public.profiles(id),created_at timestamptz not null default now(),notes text not null default '',status text not null default 'found' check(status in ('found','damaged','unidentified','duplicate_review')),count_number integer not null check(count_number in(1,2)),check(length(public.normalize_serial(serial_number_original)) between 1 and 120),unique(inventory_session_id,serial_number_normalized));
create index serial_history on public.inventory_serial_units(serial_number_normalized,created_at);
create index serial_product on public.inventory_serial_units(product_id,location_id);
create table public.serial_observations(id uuid primary key default gen_random_uuid(),inventory_session_id uuid not null references public.inventory_sessions(id),product_id uuid not null references public.products(id),serial_unit_id uuid not null references public.inventory_serial_units(id),count_number integer not null default 2 check(count_number=2),user_id uuid not null references public.profiles(id),created_at timestamptz not null default now(),unique(inventory_session_id,serial_unit_id,count_number));
create table public.product_checks(id uuid primary key default gen_random_uuid(),inventory_session_id uuid not null references public.inventory_sessions(id),product_id uuid not null references public.products(id),count_number integer not null check(count_number in(1,2)),user_id uuid not null references public.profiles(id),created_at timestamptz not null default now(),unique(inventory_session_id,product_id,count_number));
create table public.expected_inventory(id uuid primary key default gen_random_uuid(),inventory_session_id uuid not null references public.inventory_sessions(id),product_id uuid not null references public.products(id),location_id uuid not null references public.locations(id),expected_quantity integer not null check(expected_quantity between 0 and 1000000),unique(inventory_session_id,product_id,location_id));
create table public.expected_serials(id uuid primary key default gen_random_uuid(),inventory_session_id uuid not null references public.inventory_sessions(id),product_id uuid not null references public.products(id),location_id uuid not null references public.locations(id),serial_number text not null,serial_number_normalized text generated always as(public.normalize_serial(serial_number)) stored,unique(inventory_session_id,serial_number_normalized));
create index expected_serial_lookup on public.expected_serials(serial_number_normalized);
create table public.unidentified_items(id uuid primary key default gen_random_uuid(),inventory_session_id uuid not null references public.inventory_sessions(id),location_id uuid not null references public.locations(id),barcode text not null default '',notes text not null default '',photo_url text not null default '',kind text not null default 'unknown',user_id uuid not null references public.profiles(id),created_at timestamptz not null default now(),resolved_at timestamptz,resolution text);
create index unidentified_session on public.unidentified_items(inventory_session_id);
create table public.inventory_audit_log(id uuid primary key default gen_random_uuid(),inventory_session_id uuid references public.inventory_sessions(id),actor_id uuid references public.profiles(id),action text not null,entity_id uuid,before_data jsonb,after_data jsonb,created_at timestamptz not null default now());
create index audit_session on public.inventory_audit_log(inventory_session_id,created_at);
create table public.applied_operations(id uuid primary key,user_id uuid not null references public.profiles(id),created_at timestamptz not null default now());

create function public.current_role() returns text language sql stable security definer set search_path=public as $$ select role from profiles where id=auth.uid() and active $$;
create function public.can_session(sid uuid) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from inventory_sessions where id=sid and public.current_role() is not null and (user_id=auth.uid() or public.current_role() in('admin','supervisor'))) $$;
create function public.can_expected(sid uuid) returns boolean language sql stable security definer set search_path=public as $$ select public.current_role() in('admin','supervisor') and exists(select 1 from inventory_sessions where id=sid and status in('review','recount','completed')) $$;
create function public.new_profile() returns trigger language plpgsql security definer set search_path=public as $$ begin insert into profiles(id,full_name) values(new.id,coalesce(nullif(new.raw_user_meta_data->>'full_name',''),split_part(new.email,'@',1)));return new;end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.new_profile();

do $$ declare t text;begin
foreach t in array array['profiles','locations','products','product_barcodes','inventory_sessions','session_products','inventory_counts','inventory_serial_units','serial_observations','product_checks','expected_inventory','expected_serials','unidentified_items','inventory_audit_log','applied_operations'] loop
execute format('alter table public.%I enable row level security',t);
execute format('revoke all on public.%I from anon, authenticated',t);
execute format('grant select on public.%I to authenticated',t);
end loop;
foreach t in array array['locations','products','product_barcodes'] loop execute format('create policy read_catalog on public.%I for select to authenticated using (public.current_role() is not null)',t);end loop;
foreach t in array array['session_products','inventory_counts','inventory_serial_units','serial_observations','product_checks','unidentified_items'] loop execute format('create policy read_session on public.%I for select to authenticated using (public.can_session(inventory_session_id))',t);end loop;
foreach t in array array['expected_inventory','expected_serials'] loop execute format('create policy supervisor_expected on public.%I for select to authenticated using (public.can_expected(inventory_session_id))',t);end loop;
end $$;
create policy read_profile on public.profiles for select to authenticated using(id=auth.uid() or public.current_role() in('admin','supervisor'));
create policy read_inventory on public.inventory_sessions for select to authenticated using(public.can_session(id));
create policy read_audit on public.inventory_audit_log for select to authenticated using(public.current_role() in('admin','supervisor') and (action not like 'expected_%' or public.can_expected(inventory_session_id)));
create policy read_operation on public.applied_operations for select to authenticated using(user_id=auth.uid());

create function public.audit_change() returns trigger language plpgsql security definer set search_path=public as $$ declare v jsonb;sid uuid;begin
v=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;if tg_table_name='inventory_sessions' then sid=(v->>'id')::uuid;else sid=(v->>'inventory_session_id')::uuid;end if;
insert into inventory_audit_log(inventory_session_id,actor_id,action,entity_id,before_data,after_data) values(sid,auth.uid(),tg_table_name||':'||tg_op,(v->>'id')::uuid,case when tg_op in('UPDATE','DELETE') then to_jsonb(old) else null end,case when tg_op='DELETE' then null else v end);return coalesce(new,old);end $$;
do $$ declare t text;begin foreach t in array array['products','product_barcodes','locations','profiles','inventory_sessions','inventory_counts','inventory_serial_units','serial_observations','product_checks','unidentified_items','expected_inventory','expected_serials'] loop execute format('create trigger audit_row after insert or update or delete on public.%I for each row execute function public.audit_change()',t);end loop;end $$;

-- All writes go through one transactional, idempotent RPC. Table DML is not granted to clients.
create function public.apply_operation(command jsonb) returns jsonb language plpgsql security definer set search_path=public as $$
declare actor uuid:=auth.uid();r text:=public.current_role();op text:=command->>'type';p jsonb:=command->'payload';oid uuid:=(command->>'id')::uuid;s inventory_sessions%rowtype;prod products%rowtype;unit inventory_serial_units%rowtype;sid uuid:=(p->>'inventory_session_id')::uuid;pid uuid:=(p->>'product_id')::uuid;round integer;target text;row jsonb;code text;qty integer;loc uuid;newid uuid;previous products%rowtype;
begin
if actor is null or r is null then raise exception 'Usuario no autorizado';end if;
if oid is null then raise exception 'ID de operación obligatorio';end if;
perform pg_advisory_xact_lock(hashtextextended(oid::text,0));
if exists(select 1 from applied_operations where id=oid and user_id=actor) then return jsonb_build_object('ok',true,'replayed',true);end if;
if sid is not null then select * into s from inventory_sessions where id=sid for update;if s.id is null or not public.can_session(sid) then raise exception 'Inventario no autorizado';end if;if s.status='completed' then raise exception 'Inventario cerrado';end if;round=case when s.status='recount' then 2 else 1 end;end if;
if op in('count','serial','finish_product') then
select * into prod from products where id=pid;
if s.id is null or prod.id is null or s.status not in('counting','recount') or not exists(select 1 from session_products where inventory_session_id=sid and product_id=pid and (round=1 or recount_required)) then raise exception 'Sesión o producto no editable';end if;
end if;
case op
when 'create_session' then
if (p->>'user_id')::uuid<>actor and r='counter' then raise exception 'Responsable no autorizado';end if;
if not exists(select 1 from profiles where id=(p->>'user_id')::uuid and active) or not exists(select 1 from locations where id=(p->>'location_id')::uuid and active) then raise exception 'Responsable o ubicación inválida';end if;
insert into inventory_sessions(id,name,location_id,user_id,status) values((p->>'id')::uuid,trim(p->>'name'),(p->>'location_id')::uuid,(p->>'user_id')::uuid,case when coalesce((p->>'draft')::boolean,false) then 'draft' else 'counting' end) returning * into s;
insert into session_products(inventory_session_id,product_id) select s.id,id from products where active;
if not found then raise exception 'Agrega productos antes de crear un inventario';end if;
when 'count' then
if prod.serialized then raise exception 'El producto requiere series individuales';end if;
if (p->>'quantity') !~ '^[0-9]+$' then raise exception 'Cantidad entera requerida';end if;
insert into inventory_counts(id,inventory_session_id,product_id,location_id,quantity,user_id,count_number) values(oid,sid,pid,s.location_id,(p->>'quantity')::integer,actor,round) on conflict(inventory_session_id,product_id,count_number) do update set quantity=excluded.quantity,user_id=actor,updated_at=now();
insert into product_checks(inventory_session_id,product_id,count_number,user_id) values(sid,pid,round,actor) on conflict do nothing;
when 'serial' then
if not prod.serialized then raise exception 'El producto se cuenta por cantidad';end if;
code=public.normalize_serial(p->>'serial_number');
select * into unit from inventory_serial_units where inventory_session_id=sid and serial_number_normalized=code;
if unit.id is not null and (round=1 or unit.product_id<>pid or exists(select 1 from serial_observations where serial_unit_id=unit.id and count_number=2)) then raise exception 'SERIE YA REGISTRADA' using errcode='23505';end if;
if unit.id is null then insert into inventory_serial_units(id,inventory_session_id,product_id,location_id,serial_number_original,serial_barcode,photo_url,user_id,notes,status,count_number) values(oid,sid,pid,s.location_id,p->>'serial_number',coalesce(p->>'serial_barcode',''),coalesce(p->>'photo_url',''),actor,coalesce(p->>'notes',''),coalesce(p->>'status','found'),round) returning * into unit;end if;
if round=2 then insert into serial_observations(inventory_session_id,product_id,serial_unit_id,user_id) values(sid,pid,unit.id,actor);end if;
when 'finish_product' then
if not prod.serialized then raise exception 'Guarda una cantidad para este producto';end if;
insert into product_checks(inventory_session_id,product_id,count_number,user_id) values(sid,pid,round,actor) on conflict do nothing;
when 'transition' then
target=p->>'status';
if s.status='draft' and target='counting' then null;
elsif s.status in('counting','recount') and target='review' then
if exists(select 1 from session_products sp where sp.inventory_session_id=sid and (round=1 or sp.recount_required) and not exists(select 1 from product_checks pc where pc.inventory_session_id=sid and pc.product_id=sp.product_id and pc.count_number=round)) then raise exception 'Termina todos los productos antes de revisar';end if;
elsif s.status='review' and target='recount' and r in('admin','supervisor') then
if exists(select 1 from product_checks where inventory_session_id=sid and count_number=2) then raise exception 'El segundo conteo ya se realizó';end if;
update session_products sp set recount_required=exists(select 1 from expected_inventory ei join products pr on pr.id=ei.product_id where ei.inventory_session_id=sid and ei.product_id=sp.product_id and ei.location_id=s.location_id and (ei.expected_quantity <> case when pr.serialized then (select count(*) from inventory_serial_units u where u.inventory_session_id=sid and u.product_id=pr.id and u.count_number=1) else (select quantity from inventory_counts c where c.inventory_session_id=sid and c.product_id=pr.id and c.count_number=1) end or (pr.serialized and (exists(select 1 from expected_serials es where es.inventory_session_id=sid and es.product_id=pr.id and es.location_id=s.location_id and not exists(select 1 from inventory_serial_units u where u.inventory_session_id=sid and u.product_id=pr.id and u.count_number=1 and u.serial_number_normalized=es.serial_number_normalized)) or exists(select 1 from inventory_serial_units u where u.inventory_session_id=sid and u.product_id=pr.id and u.count_number=1 and not exists(select 1 from expected_serials es where es.inventory_session_id=sid and es.product_id=pr.id and es.location_id=s.location_id and es.serial_number_normalized=u.serial_number_normalized)))))) where sp.inventory_session_id=sid;
if not exists(select 1 from session_products where inventory_session_id=sid and recount_required) then raise exception 'No hay diferencias para recontar';end if;
elsif s.status='review' and target='completed' and r in('admin','supervisor') then
if exists(select 1 from unidentified_items where inventory_session_id=sid and resolved_at is null) then raise exception 'Resuelve las incidencias antes de cerrar';end if;
else raise exception 'Transición no permitida';end if;
update inventory_sessions set status=target,completed_at=case when target='completed' then now() else null end where id=sid;
when 'unknown' then
if s.id is null or s.status not in('counting','recount') then raise exception 'Sesión no editable';end if;
insert into unidentified_items(id,inventory_session_id,location_id,barcode,notes,photo_url,kind,user_id) values(oid,sid,s.location_id,coalesce(p->>'barcode',''),coalesce(p->>'notes',''),coalesce(p->>'photo_url',''),coalesce(p->>'kind','unknown'),actor);
when 'resolve' then
if r='counter' or s.id is null or length(trim(coalesce(p->>'resolution','')))=0 then raise exception 'Resolución no autorizada o vacía';end if;
update unidentified_items set resolved_at=now(),resolution=p->>'resolution' where id=(p->>'id')::uuid and inventory_session_id=sid;
when 'add_location' then
if r<>'admin' then raise exception 'Se requiere administrador';end if;
insert into locations(name) values(trim(p->>'name'));
when 'update_profile' then
if r<>'admin' or (p->>'id')::uuid=actor then raise exception 'No puedes modificar tu propio acceso';end if;
update profiles set role=p->>'role',active=(p->>'active')::boolean where id=(p->>'id')::uuid;
when 'save_product' then
if r<>'admin' then raise exception 'Se requiere administrador';end if;
if coalesce(p->>'barcode','')<>coalesce(p->'barcodes'->>0,'') then raise exception 'El código principal debe ser el primer código';end if;
newid=coalesce(nullif(p->>'id','')::uuid,gen_random_uuid());select * into previous from products where id=newid;
if previous.id is not null and previous.serialized<>(p->>'serialized')::boolean and exists(select 1 from session_products where product_id=newid) then raise exception 'No cambies el tipo de un producto inventariado';end if;
insert into products(id,sku,name,description,brand,category,barcode,supplier_code,serialized,photo_url,active) values(newid,trim(p->>'sku'),trim(p->>'name'),coalesce(p->>'description',''),coalesce(p->>'brand',''),coalesce(p->>'category',''),coalesce(p->>'barcode',''),coalesce(p->>'supplier_code',''),(p->>'serialized')::boolean,coalesce(p->>'photo_url',''),coalesce((p->>'active')::boolean,true)) on conflict(id) do update set sku=excluded.sku,name=excluded.name,description=excluded.description,brand=excluded.brand,category=excluded.category,barcode=excluded.barcode,supplier_code=excluded.supplier_code,serialized=excluded.serialized,photo_url=excluded.photo_url,active=excluded.active,updated_at=now();
delete from product_barcodes where product_id=newid;
for code in select distinct value from jsonb_array_elements_text(coalesce(p->'barcodes','[]')) loop if length(trim(code))>0 then insert into product_barcodes(product_id,barcode,is_primary) values(newid,trim(code),code=p->>'barcode');end if;end loop;
when 'import_products' then
if r<>'admin' then raise exception 'Se requiere administrador';end if;
if jsonb_array_length(p->'rows')>2000 then raise exception 'Importa como máximo 2000 productos por lote';end if;
for row in select value from jsonb_array_elements(p->'rows') loop
if lower(coalesce(row->>'serialized','false')) not in('true','false','1','0','si','sí','no') then raise exception 'serialized inválido';end if;
insert into products(sku,name,description,brand,category,barcode,supplier_code,serialized) values(trim(row->>'sku'),trim(row->>'name'),coalesce(row->>'description',''),coalesce(row->>'brand',''),coalesce(row->>'category',''),trim(split_part(coalesce(row->>'barcode',''),'|',1)),coalesce(row->>'supplier_code',''),lower(coalesce(row->>'serialized','false')) in('true','1','si','sí')) returning id into newid;
foreach code in array string_to_array(coalesce(row->>'barcode',''),'|') loop if length(trim(code))>0 then insert into product_barcodes(product_id,barcode,is_primary) values(newid,trim(code),code=split_part(row->>'barcode','|',1));end if;end loop;
end loop;
when 'import_expected' then
if r='counter' or s.status<>'draft' or s.id is null then raise exception 'Importa existencias en un borrador';end if;
delete from expected_serials where inventory_session_id=sid;delete from expected_inventory where inventory_session_id=sid;
for row in select value from jsonb_array_elements(p->'rows') loop
select id into pid from products where sku=row->>'sku';select id into loc from locations where name=row->>'location';loc=coalesce(loc,s.location_id);if pid is null or not exists(select 1 from session_products where inventory_session_id=sid and product_id=pid) then raise exception 'SKU fuera del alcance';end if;
if (row->>'expected_quantity') !~ '^[0-9]+$' then raise exception 'Cantidad esperada inválida';end if;qty=(row->>'expected_quantity')::integer;
insert into expected_inventory(inventory_session_id,product_id,location_id,expected_quantity) values(sid,pid,loc,qty);
foreach code in array string_to_array(coalesce(row->>'serials',''),'|') loop if length(trim(code))>0 then insert into expected_serials(inventory_session_id,product_id,location_id,serial_number) values(sid,pid,loc,code);end if;end loop;
if (select serialized from products where id=pid) and qty<>(select count(*) from expected_serials where inventory_session_id=sid and product_id=pid and location_id=loc) then raise exception 'Cantidad y número de series esperadas no coinciden';end if;
end loop;
else raise exception 'Operación no soportada';end case;
insert into applied_operations(id,user_id) values(oid,actor);
return jsonb_build_object('ok',true,'session_id',s.id);
end $$;
revoke execute on all functions in schema public from public,anon;
grant execute on function public.current_role(),public.can_session(uuid),public.can_expected(uuid),public.normalize_serial(text),public.apply_operation(jsonb) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('inventory-photos','inventory-photos',false,2097152,array['image/jpeg','image/png','image/webp']) on conflict(id) do nothing;
create policy read_photos on storage.objects for select to authenticated using(bucket_id='inventory-photos' and (((storage.foldername(name))[1]='products' and public.current_role() is not null) or ((storage.foldername(name))[1]='sessions' and public.can_session(((storage.foldername(name))[2])::uuid))));
create policy upload_photos on storage.objects for insert to authenticated with check(bucket_id='inventory-photos' and (((storage.foldername(name))[1]='products' and public.current_role()='admin') or ((storage.foldername(name))[1]='sessions' and public.can_session(((storage.foldername(name))[2])::uuid) and exists(select 1 from public.inventory_sessions where id=((storage.foldername(name))[2])::uuid and status in('counting','recount')))));

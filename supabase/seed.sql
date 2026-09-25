-- Fictitious catalog; never loads expected stock into a real session automatically.
insert into public.locations(id,name) values ('10000000-0000-4000-8000-000000000001','Juárez'),('10000000-0000-4000-8000-000000000002','Almacén'),('10000000-0000-4000-8000-000000000003','Bodega'),('10000000-0000-4000-8000-000000000004','Departamento') on conflict do nothing;
insert into public.products(id,sku,name,brand,category,barcode,serialized) values
('20000000-0000-4000-8000-000000000001','CHC-110','Congelador horizontal CHC-110','Torrey','Refrigeración','7500000000010',true),
('20000000-0000-4000-8000-000000000002','VR-12','Refrigerador vertical VR-12','Imbera','Refrigeración','7500000000020',true),
('20000000-0000-4000-8000-000000000003','BAR-8','Báscula comercial BAR-8','Rhino','Básculas','7500000000030',true),
('20000000-0000-4000-8000-000000000004','ACC-X','Accesorio X · repuesto universal','EMYCE','Refacciones','7500000000040',false) on conflict do nothing;
insert into public.product_barcodes(product_id,barcode,is_primary) select id,barcode,true from public.products where barcode<>'' on conflict do nothing;
insert into public.product_barcodes(product_id,barcode) select id,'DEMO-'||sku from public.products where sku in('CHC-110','VR-12','BAR-8','ACC-X') on conflict do nothing;

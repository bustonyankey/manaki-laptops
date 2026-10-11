import zipfile
import xml.etree.ElementTree as ET
import sys
import re
import json
import os

sys.stdout.reconfigure(encoding='utf-8')

pics_dir = r'C:\Users\busto\OneDrive\Desktop\AKIOLA LAPTOPS\Laptop pictures'
p_deals = r'C:\Users\busto\OneDrive\Desktop\AKIOLA LAPTOPS\LAPTOP DEALS AVAILABLE NOW.docx'
p_shipment = r'C:\Users\busto\OneDrive\Desktop\AKIOLA LAPTOPS\Laptop pictures\Akiola Laptop - Oct Shipment.docx'

# 1. Image map
all_pics = sorted(os.listdir(pics_dir))
img_map = {}
for f in all_pics:
    m = re.match(r'^L\s*(\d+(?:-\d+)?)\s*(.*)', f, re.IGNORECASE)
    if m:
        num = m.group(1)
        img_map.setdefault(num, []).append('images/' + f)

def get_paras(path):
    with zipfile.ZipFile(path) as z:
        tree = ET.fromstring(z.read('word/document.xml'))
        paras = []
        for p in tree.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}p'):
            t = ''.join(node.text for node in p.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}t') if node.text)
            if t.strip():
                paras.append(t.strip())
        return paras

deals_paras = get_paras(p_deals)
shipment_paras = get_paras(p_shipment)

# Parse deals
deals_entries = []
curr = []
for p in deals_paras:
    if '━━━━' in p:
        if curr:
            deals_entries.append(curr)
            curr = []
    else:
        curr.append(p)
if curr:
    deals_entries.append(curr)

deals_dict = {}
for lines in deals_entries:
    header = lines[0]
    price_line = lines[1] if len(lines) > 1 else ''
    m = re.match(r'^(\d+)\.\s*[^\w\s]*\s*(.+)', header)
    if not m:
        continue
    num = int(m.group(1))
    rest = m.group(2)
    parts = [p.strip() for p in rest.split('•')]
    title = re.sub(r'[^\w\s\-\(\)\/\.\+]', '', parts[0]).strip()
    specs = parts[1:]
    pm = re.search(r'GH[₵S]?\s*([\d,]+)', price_line, re.IGNORECASE)
    price = int(pm.group(1).replace(',', '')) if pm else (5200 if num == 36 else 4500)
    price_fmt = f'GH₵{price:,}'
    deals_dict[num] = {
        'num': num,
        'title': title,
        'specs': specs,
        'price': price,
        'price_fmt': price_fmt,
        'price_line': price_line
    }

# Known shipment data for SOLD laptops or extra notes
shipment_extra = {
    5: {
        'title': 'Dell Precision 5560 Workstation',
        'specs': ['Core i7 | 11th Gen', '2.50GHz', '32GB RAM | 512GB SSD', '4GB Dedicated Graphics', 'Touchscreen', 'Backlit Keyboard', 'Fingerprint Scanner', '15.6" Display'],
        'price': 6000,
        'price_fmt': 'GH₵6,000',
        'status': 'Sold Out',
        'notes': 'High-end workstation (Sold Out)'
    },
    19: {
        'title': 'Dell Latitude 7420 2-in-1',
        'specs': ['Core i7 | 11th Gen', '3.0GHz', '16GB RAM | 256GB SSD', 'Touchscreen', 'Fingerprint Scanner', 'Backlit Keyboard', '360° Convertible', '14" Display'],
        'price': 4000,
        'price_fmt': 'GH₵4,000',
        'status': 'Sold Out',
        'notes': 'Premium enterprise 2-in-1 (Sold Out)'
    },
    37: {
        'title': 'Lenovo Flex 5',
        'specs': ['Core i5 | 11th Gen', '2.4GHz', '8GB RAM | 256GB SSD', 'Touchscreen', 'Fingerprint Scanner', 'Backlit Keyboard', '360° Convertible', '14" Display'],
        'price': 5200,
        'price_fmt': 'GH₵5,200',
        'status': 'Sold Out',
        'notes': 'Almost New (Sold Out)'
    }
}

laptops = []

for num in range(1, 42):
    deal = deals_dict.get(num)
    extra = shipment_extra.get(num)
    
    if not deal and not extra:
        continue
        
    title = deal['title'] if deal else extra['title']
    specs = deal['specs'] if deal else extra['specs']
    price = deal['price'] if deal else extra['price']
    price_fmt = deal['price_fmt'] if deal else extra['price_fmt']
    
    # Clean Title
    title = title.replace('  ', ' ').strip()
    
    # Brand detection
    brand = 'Dell'
    if 'HP' in title or 'ProBook' in title or 'EliteBook' in title or 'Pavilion' in title:
        brand = 'HP'
    elif 'Lenovo' in title or 'ThinkPad' in title or 'Yoga' in title or 'Flex' in title:
        brand = 'Lenovo'
    elif 'MacBook' in title or 'Apple' in title:
        brand = 'Apple'
    elif 'Samsung' in title:
        brand = 'Samsung'
    elif 'Acer' in title:
        brand = 'Acer'
    elif 'Surface' in title or 'Microsoft' in title:
        brand = 'Microsoft'
    elif 'Dell' in title or 'XPS' in title or 'Latitude' in title or 'Precision' in title or 'Inspiron' in title:
        brand = 'Dell'

    # Specs parsing from specs list
    full_specs_text = ' '.join(specs)
    
    # Processor & Generation
    processor = 'Intel Core i5'
    generation = ''
    if 'Core i7' in full_specs_text or 'i7' in title:
        processor = 'Intel Core i7'
    elif 'Core i5' in full_specs_text or 'i5' in title:
        processor = 'Intel Core i5'
    elif 'Core i3' in full_specs_text or 'i3' in title:
        processor = 'Intel Core i3'
    elif 'AMD Ryzen 7' in full_specs_text:
        processor = 'AMD Ryzen 7 Pro'
    elif 'AMD Ryzen 5' in full_specs_text or 'Ryzen 5' in title:
        processor = 'AMD Ryzen 5'
    elif 'Intel Xeon' in full_specs_text:
        processor = 'Intel Xeon'
    elif 'Core m5' in full_specs_text:
        processor = 'Intel Core m5'
        
    gen_m = re.search(r'(\d+)(?:th|st|nd|rd)\s*Gen', full_specs_text, re.IGNORECASE)
    if gen_m:
        generation = f"{gen_m.group(1)}th Gen"
    elif brand == 'Apple':
        generation = '2017 Model'

    # Speed
    speed = ''
    speed_m = re.search(r'([\d\.]+)\s*GHz', full_specs_text, re.IGNORECASE)
    if speed_m:
        speed = f"{speed_m.group(1)} GHz"

    # RAM
    ram = '8GB'
    ram_gb = 8
    ram_m = re.search(r'(\d+)\s*GB\s*RAM', full_specs_text, re.IGNORECASE)
    if ram_m:
        ram_gb = int(ram_m.group(1))
        ram = f"{ram_gb}GB"

    # Storage
    storage = '256GB SSD'
    storage_gb = 256
    storage_type = 'SSD'
    storage_m = re.search(r'(\d+)\s*(GB|TB)\s*(SSD|HDD)?', full_specs_text, re.IGNORECASE)
    if storage_m:
        sz = int(storage_m.group(1))
        unit = storage_m.group(2).upper()
        stype = (storage_m.group(3) or 'SSD').upper()
        if unit == 'TB':
            storage_gb = sz * 1024
            storage = f"{sz}TB {stype}"
        else:
            storage_gb = sz
            storage = f"{sz}GB {stype}"
        storage_type = stype

    # Display / Screen size
    screen_size = '14"'
    disp_m = re.search(r'([\d\.]+)\s*(?:["\']|Display|Screen)', full_specs_text, re.IGNORECASE)
    if disp_m:
        sz_val = disp_m.group(1)
        screen_size = f'{sz_val}"'

    # Graphics
    graphics = 'Integrated Intel UHD Graphics'
    has_dedicated_gpu = False
    gpu_m = re.search(r'(\d+)\s*GB\s*(?:Dedicated|VGA)', full_specs_text, re.IGNORECASE)
    if gpu_m:
        graphics = f"{gpu_m.group(1)}GB Dedicated Graphics"
        has_dedicated_gpu = True
    elif 'AMD' in processor:
        graphics = 'AMD Radeon Graphics'
    elif 'Apple' in brand:
        graphics = 'Intel Iris Plus Graphics 640'

    # Features
    is_touchscreen = bool(re.search(r'Touchscreen|Touch\s*Screen|Screen\s*Touch', full_specs_text, re.IGNORECASE))
    is_convertible = bool(re.search(r'360|Convertible|2-in-1', full_specs_text + ' ' + title, re.IGNORECASE))
    has_backlit = bool(re.search(r'Backlit|Backlight', full_specs_text, re.IGNORECASE))
    has_fingerprint = bool(re.search(r'Fingerprint|Finger\s*Print', full_specs_text, re.IGNORECASE))
    has_alexa = bool(re.search(r'Alexa', full_specs_text, re.IGNORECASE))

    features_list = []
    if is_touchscreen:
        features_list.append('Touchscreen')
    if is_convertible:
        features_list.append('360° Convertible')
    if has_backlit:
        features_list.append('Backlit Keyboard')
    if has_fingerprint:
        features_list.append('Fingerprint Scanner')
    if has_dedicated_gpu:
        features_list.append(graphics)
    if has_alexa:
        features_list.append('Alexa Built-in')
    if 'Strong Battery' in full_specs_text or '8+ Hours' in full_specs_text or '10+ Hours' in full_specs_text:
        features_list.append('Extended Battery Life (8-10+ Hrs)')

    # Specific category
    category = 'Business'
    if has_dedicated_gpu and ('Gaming' in title or 'Nitro' in title):
        category = 'Gaming'
    elif 'Workstation' in title or 'Precision' in title:
        category = 'Workstation'
    elif is_convertible or is_touchscreen:
        category = '2-in-1 Touch'
    elif 'XPS' in title or 'MacBook' in title or 'Yoga' in title or 'Envy' in title:
        category = 'Ultrabook'
    elif ram_gb >= 16:
        category = 'Performance'

    # Images
    imgs = []
    num_str = str(num)
    if num_str in img_map:
        imgs = img_map[num_str]
    elif num in [37, 38] and '37-38' in img_map:
        imgs = img_map['37-38']
    elif num == 39 and '1' in img_map:
        imgs = img_map['1'][:3]
    elif num == 40 and '32' in img_map:
        imgs = img_map['32'][:3]
    elif num == 41 and '36' in img_map:
        imgs = img_map['36'][:3]

    # Special handling for #38 specs
    if num == 38:
        processor = 'AMD Ryzen 5 / Core i5'
        generation = '11th Gen'
        ram = '8GB'
        ram_gb = 8
        storage = '256GB SSD'
        screen_size = '14"'
        is_touchscreen = True
        is_convertible = True
        has_backlit = True
        has_fingerprint = True
        features_list = ['Touchscreen', '360° Convertible', 'Fingerprint Scanner', 'Backlit Keyboard', 'Almost New Grade A+']
        category = '2-in-1 Touch'

    # Status
    status = 'Available'
    if num in [5, 19, 37]:
        status = 'Sold Out'
    elif num == 38 or 'Almost New' in title:
        status = 'Almost New'
    elif num in [4, 9, 22, 30]:
        status = 'Hot Deal'

    # Original price / discount
    original_price = int(price * 1.1)
    if original_price % 50 != 0:
        original_price = (original_price // 50 + 1) * 50

    # Descriptions
    desc = f"{title} powered by {processor} {generation} with {ram} RAM and ultra-fast {storage}. "
    if is_convertible:
        desc += "Features a 360-degree convertible hinge for versatile laptop and tablet productivity on the go. "
    elif has_dedicated_gpu:
        desc += f"Equipped with {graphics} making it outstanding for design, video editing, CAD, and gaming. "
    else:
        desc += "Engineered for speed, durability, and seamless everyday multitasking for professionals and students. "
    
    if has_backlit:
        desc += "Comes with a backlit keyboard for comfortable typing in any lighting condition. "
    if is_touchscreen:
        desc += "Crisp, responsive touchscreen display."

    featured = num in [1, 2, 4, 7, 9, 16, 22, 33]

    laptops.append({
        'id': num,
        'number': num,
        'title': title,
        'brand': brand,
        'category': category,
        'processor': processor,
        'generation': generation,
        'speed': speed or 'Up to 3.4 GHz Turbo',
        'ram': ram,
        'ramGb': ram_gb,
        'storage': storage,
        'storageGb': storage_gb,
        'storageType': storage_type,
        'display': f'{screen_size} FHD Display' + (' (Touch)' if is_touchscreen else ''),
        'screenSize': screen_size,
        'graphics': graphics,
        'hasDedicatedGpu': has_dedicated_gpu,
        'isTouchscreen': is_touchscreen,
        'isConvertible': is_convertible,
        'hasBacklitKeyboard': has_backlit,
        'hasFingerprint': has_fingerprint,
        'features': features_list,
        'price': price,
        'priceFormatted': f"GH₵{price:,}",
        'originalPrice': original_price,
        'originalPriceFormatted': f"GH₵{original_price:,}",
        'status': status,
        'condition': 'Grade A+ Clean Direct Import',
        'battery': 'Tested Strong Battery (Health 85%+)',
        'description': desc.strip(),
        'images': imgs,
        'featured': featured,
        'views': 120 + (num * 17) % 400
    })

# Save JSON
with open('data/laptops.json', 'w', encoding='utf-8') as f:
    json.dump(laptops, f, indent=2, ensure_ascii=False)

# Save JS
js_content = '/**\n * Akiola Laptops Catalog Dataset\n * Automatically initialized and saved to localStorage for client-side persistence & CRUD\n */\n'
js_content += 'window.DEFAULT_LAPTOPS = ' + json.dumps(laptops, indent=2, ensure_ascii=False) + ';\n'

with open('js/data.js', 'w', encoding='utf-8') as f:
    f.write(js_content)

print(f"Generated {len(laptops)} laptops successfully!")
print(f"Items with images: {sum(1 for l in laptops if len(l['images']) > 0)} / {len(laptops)}")
for l in laptops[:5]:
    print(f"#{l['id']} {l['title']} - {l['priceFormatted']} ({len(l['images'])} images)")

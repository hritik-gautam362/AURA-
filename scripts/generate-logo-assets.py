"""
Asset generation script for Orienta by FillFlow:
Extracts and generates all high-resolution logo and PWA icon assets
from the official colorful geometric/mosaic logo source image.
"""

import os
import base64
from PIL import Image, ImageDraw

def generate_assets():
    src_path = r'C:\Users\Hritik\.gemini\antigravity-ide\brain\29acf68c-5b31-4f7b-9797-821bc1660d52\.user_uploaded\media_1791033469774.png'
    if not os.path.exists(src_path):
        raise FileNotFoundError(f"Source logo not found at {src_path}")

    img = Image.open(src_path)
    print(f"Loaded source image: {img.size}, mode: {img.mode}")

    # Exact mathematical bounding box:
    # 278 left, 278 right (1024 - 746 = 278)
    # 45 top, 45 bottom (558 - 513 = 45)
    box = (278, 45, 746, 513) # 468 x 468 px
    badge = img.crop(box).convert('RGBA')

    # Generate 512x512 master symbol with supersampled anti-aliased mask
    target_size = 512
    scale = 4
    big_size = target_size * scale
    # Corner radius on 468 is 89px. Scaled to target_size * scale:
    big_radius = int(89 * (target_size / 468) * scale)

    big_mask = Image.new('L', (big_size, big_size), 0)
    draw = ImageDraw.Draw(big_mask)
    draw.rounded_rectangle([(0, 0), (big_size - 1, big_size - 1)], radius=big_radius, fill=255)

    smooth_mask = big_mask.resize((target_size, target_size), Image.Resampling.LANCZOS)

    symbol_512 = badge.resize((target_size, target_size), Image.Resampling.LANCZOS)
    symbol_512.putalpha(smooth_mask)

    # 1. Master symbol & logo
    os.makedirs('public/icons', exist_ok=True)
    symbol_512.save('public/orienta-symbol.png', 'PNG', optimize=True)
    symbol_512.save('public/orienta-logo.png', 'PNG', optimize=True)
    symbol_512.save('public/icons/icon-512x512.png', 'PNG', optimize=True)
    symbol_512.save('public/icons/maskable-icon-512x512.png', 'PNG', optimize=True)

    # 2. 192x192
    symbol_192 = symbol_512.resize((192, 192), Image.Resampling.LANCZOS)
    symbol_192.save('public/icons/icon-192x192.png', 'PNG', optimize=True)

    # 3. 48x48
    symbol_48 = symbol_512.resize((48, 48), Image.Resampling.LANCZOS)
    symbol_48.save('public/icons/icon-48x48.png', 'PNG', optimize=True)

    # 4. Favicon PNG (32x32)
    symbol_32 = symbol_512.resize((32, 32), Image.Resampling.LANCZOS)
    symbol_32.save('public/favicon.png', 'PNG', optimize=True)

    # 5. Favicon ICO (16x16, 32x32, 48x48)
    symbol_512.save('public/favicon.ico', format='ICO', sizes=[(16, 16), (32, 32), (48, 48)])

    # 6. Base64 string for SVG wrappers
    png_bytes = open('public/icons/icon-512x512.png', 'rb').read()
    b64_str = base64.b64encode(png_bytes).decode('utf-8')

    svg_content = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <image href="data:image/png;base64,{b64_str}" width="512" height="512" />
</svg>
'''

    with open('public/icons/icon.svg', 'w', encoding='utf-8') as f:
        f.write(svg_content)

    with open('public/icons/maskable-icon.svg', 'w', encoding='utf-8') as f:
        f.write(svg_content)

    print("Successfully generated all 10 assets from source logo!")

if __name__ == '__main__':
    generate_assets()

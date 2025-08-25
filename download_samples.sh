#!/bin/bash

# Script để download ảnh mẫu kiến trúc
cd /home/user/webapp/public/static/samples

# Modern architecture
curl -L "https://f7e5m2b4.delivery.rocketcdn.me/wp-content/uploads/2015/11/Innovative-Sustainable-Villa-Built-from-Glass-Steel-and-Concrete-4.jpg" \
  -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" \
  --fail --max-time 30 -o modern.jpg

# Classical architecture
curl -L "https://cdn.britannica.com/89/169089-050-C2C5F466/Colonnade-Stoa-of-Attalos-Athens.jpg" \
  -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" \
  --fail --max-time 30 -o classical.jpg

# Traditional architecture
curl -L "https://thumbs.dreamstime.com/b/chengdu-china-november-typical-historic-wooden-temple-building-curved-wood-decorations-wooden-chinese-house-temple-171111859.jpg" \
  -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" \
  --fail --max-time 30 -o traditional.jpg

echo "Downloaded sample architectural photos"
ls -la *.jpg
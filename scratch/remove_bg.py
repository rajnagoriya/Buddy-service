from PIL import Image
import os

def make_transparent(img_path):
    if not os.path.exists(img_path):
        print(f"File not found: {img_path}")
        return
    img = Image.open(img_path)
    img = img.convert("RGBA")
    datas = img.getdata()
    
    newData = []
    for item in datas:
        # If the pixel is close to white, make it transparent
        # We define a threshold, e.g., if R > 240, G > 240, B > 240
        if item[0] > 240 and item[1] > 240 and item[2] > 240:
            newData.append((255, 255, 255, 0))
        else:
            newData.append(item)
            
    img.putdata(newData)
    img.save(img_path, "PNG")
    print(f"Processed: {img_path}")

make_transparent("c:/Users/admin/Desktop/Buddy-service/Frontend/public/super-app/food.png")
make_transparent("c:/Users/admin/Desktop/Buddy-service/Frontend/public/super-app/taxi.png")
make_transparent("c:/Users/admin/Desktop/Buddy-service/Frontend/public/super-app/grocery.png")
print("Done making images transparent!")

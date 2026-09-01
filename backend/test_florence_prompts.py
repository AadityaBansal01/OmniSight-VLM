import os
import cv2
import torch
from transformers import AutoProcessor, AutoModelForCausalLM
from PIL import Image

video_path = os.environ.get("VIDEO_PATH", "backend/data/videos/real_pedestrians.mp4")
cap = cv2.VideoCapture(video_path)
cap.set(cv2.CAP_PROP_POS_MSEC, 9000) # 9 seconds
ret, frame = cap.read()
if not ret:
    print("Could not read frame at 9s")
    exit()

rgb_image = Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
print("Loaded frame at 9.0s")

model_id = "microsoft/Florence-2-base"
processor = AutoProcessor.from_pretrained(model_id, trust_remote_code=True)
model = AutoModelForCausalLM.from_pretrained(model_id, trust_remote_code=True).eval()

for prompt in ["<CAPTION>", "<DETAILED_CAPTION>", "<MORE_DETAILED_CAPTION>"]:
    inputs = processor(text=prompt, images=rgb_image, return_tensors="pt")
    with torch.no_grad():
        generated_ids = model.generate(
            input_ids=inputs["input_ids"],
            pixel_values=inputs["pixel_values"],
            max_new_tokens=1024,
            num_beams=3,
        )
    caption_raw = processor.batch_decode(generated_ids, skip_special_tokens=False)[0]
    parsed = processor.post_process_generation(caption_raw, task=prompt, image_size=(rgb_image.width, rgb_image.height))
    print(f"\nPrompt: {prompt}")
    print(f"Caption: {parsed[prompt]}")

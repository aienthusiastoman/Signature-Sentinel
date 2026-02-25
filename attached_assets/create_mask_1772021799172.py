import cv2
import numpy as np
from pdf2image import convert_from_path

print("=== Professional OpenCV Mask Creator ===")
print("Drag to select area.")
print("Press S to save | R to reset | Q to quit\n")


def create_mask(pdf_path, page_num, save_name, description):

    print(f"\nOpening: {description}")

    # Convert PDF page to image
    images = convert_from_path(pdf_path, dpi=400)
    img = np.array(images[page_num - 1])
    img = cv2.cvtColor(img, cv2.COLOR_RGB2BGR)

    clone = img.copy()
    h, w = img.shape[:2]

    ix, iy = -1, -1
    drawing = False
    rect = None

    window_name = "Draw ROI → S=Save | R=Reset | Q=Quit"
    cv2.namedWindow(window_name, cv2.WINDOW_NORMAL)

    def draw_overlay(current_img, rect_coords=None):
        display = current_img.copy()

        if rect_coords:
            x1, y1, x2, y2 = rect_coords

            # Darken entire image
            overlay = display.copy()
            overlay[:] = (0, 0, 0)
            display = cv2.addWeighted(display, 0.4, overlay, 0.6, 0)

            # Restore selected area brightness
            display[y1:y2, x1:x2] = current_img[y1:y2, x1:x2]

            # Bold rectangle
            cv2.rectangle(display, (x1, y1), (x2, y2), (0, 255, 0), 3)

            # Coordinates text
            text = f"({x1},{y1}) → ({x2},{y2})"
            cv2.putText(display, text, (x1, y1 - 10),
                        cv2.FONT_HERSHEY_SIMPLEX,
                        0.8, (0, 255, 0), 2)

        return display

    def mouse(event, x, y, flags, param):
        nonlocal ix, iy, drawing, rect

        if event == cv2.EVENT_LBUTTONDOWN:
            drawing = True
            ix, iy = x, y

        elif event == cv2.EVENT_MOUSEMOVE and drawing:
            x1, x2 = sorted([ix, x])
            y1, y2 = sorted([iy, y])
            rect = (x1, y1, x2, y2)
            cv2.imshow(window_name, draw_overlay(clone, rect))

        elif event == cv2.EVENT_LBUTTONUP:
            drawing = False
            x1, x2 = sorted([ix, x])
            y1, y2 = sorted([iy, y])
            rect = (x1, y1, x2, y2)
            cv2.imshow(window_name, draw_overlay(clone, rect))

    cv2.setMouseCallback(window_name, mouse)

    while True:
        if rect:
            cv2.imshow(window_name, draw_overlay(clone, rect))
        else:
            cv2.imshow(window_name, clone)

        key = cv2.waitKey(1) & 0xFF

        if key in [ord('s'), ord('S')]:
            if rect:
                x1, y1, x2, y2 = rect

                # Create full-size mask
                mask = np.zeros((h, w), dtype=np.uint8)
                mask[y1:y2, x1:x2] = 255

                # Save mask
                cv2.imwrite(save_name, mask)

                # Save preview extraction
                extracted = cv2.bitwise_and(clone, clone, mask=mask)
                preview_name = save_name.replace('.png', '_preview.png')
                cv2.imwrite(preview_name, extracted)

                print(f"✅ Mask saved: {save_name}")
                print(f"✅ Preview saved: {preview_name}")
                print(f"Coordinates: {rect}")
                break
            else:
                print("Draw a rectangle first.")

        elif key in [ord('r'), ord('R')]:
            rect = None
            print("Selection reset.")

        elif key in [ord('q'), ord('Q')]:
            print("Cancelled.")
            break

    cv2.destroyAllWindows()


# ================= CREATE MASKS =================

create_mask(
    'file1ID.pdf',
    1,
    'mask_id.png',
    'ID Card - Signature below photo'
)

print("\n" + "=" * 60)

create_mask(
    'file2PF.pdf',
    6,
    'mask_insured.png',
    'Insurance Document - Page 6 Signature'
)

print("\nDone.")
import cv2
import numpy as np
import sys
from pdf2image import convert_from_path
from skimage.morphology import skeletonize


DPI = 400


# --------------------------------------------------
# Convert PDF to images
# --------------------------------------------------
def pdf_to_images(pdf_path):
    return convert_from_path(pdf_path, dpi=DPI)


# --------------------------------------------------
# Extract dominant signature component
# --------------------------------------------------
def extract_signature_strokes(crop):

    if crop is None or crop.size == 0:
        return None

    thresh = cv2.adaptiveThreshold(
        crop,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY_INV,
        31,
        15
    )

    # Remove long horizontal lines
    horizontal_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (80, 1))
    thresh = cv2.subtract(
        thresh,
        cv2.morphologyEx(thresh, cv2.MORPH_OPEN, horizontal_kernel)
    )

    # Remove long vertical lines
    vertical_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (1, 80))
    thresh = cv2.subtract(
        thresh,
        cv2.morphologyEx(thresh, cv2.MORPH_OPEN, vertical_kernel)
    )

    num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(thresh)

    if num_labels <= 1:
        return None

    areas = stats[1:, cv2.CC_STAT_AREA]
    largest_idx = 1 + np.argmax(areas)
    largest_area = stats[largest_idx, cv2.CC_STAT_AREA]

    if largest_area < 800:
        return None

    cleaned = np.zeros_like(thresh)
    cleaned[labels == largest_idx] = 255

    return cleaned


# --------------------------------------------------
# Normalize signature
# --------------------------------------------------
def normalize_signature(img, target_height=250, target_width=600):

    coords = cv2.findNonZero(img)
    if coords is None:
        return None

    x, y, w, h = cv2.boundingRect(coords)
    img = img[y:y+h, x:x+w]

    h, w = img.shape
    scale = min(target_height / h, target_width / w)

    new_h = int(h * scale)
    new_w = int(w * scale)

    resized = cv2.resize(img, (new_w, new_h))

    canvas = np.zeros((target_height, target_width), dtype=np.uint8)

    y_offset = (target_height - new_h) // 2
    x_offset = (target_width - new_w) // 2

    canvas[y_offset:y_offset+new_h, x_offset:x_offset+new_w] = resized

    return canvas


# --------------------------------------------------
# Skeletonize
# --------------------------------------------------
def skeletonize_signature(img):
    binary = img > 0
    skeleton = skeletonize(binary)
    return (skeleton.astype(np.uint8) * 255)


# --------------------------------------------------
# Curve-based similarity (human-like)
# --------------------------------------------------
def curve_similarity(sig1, sig2):

    sig1 = normalize_signature(sig1)
    sig2 = normalize_signature(sig2)

    if sig1 is None or sig2 is None:
        return 0, None, None

    sig1 = skeletonize_signature(sig1)
    sig2 = skeletonize_signature(sig2)

    h, w = sig1.shape

    def extract_curve(img):
        curve = []
        for x in range(w):
            ys = np.where(img[:, x] > 0)[0]
            if len(ys) == 0:
                curve.append(h)
            else:
                curve.append(np.mean(ys))
        return np.array(curve)

    c1 = extract_curve(sig1)
    c2 = extract_curve(sig2)

    c1 = (c1 - np.mean(c1)) / (np.std(c1) + 1e-6)
    c2 = (c2 - np.mean(c2)) / (np.std(c2) + 1e-6)

    correlation = np.corrcoef(c1, c2)[0, 1]

    similarity = max(0, correlation) * 100

    return similarity, sig1, sig2


# --------------------------------------------------
# Smooth scaling modes
# --------------------------------------------------
def apply_match_mode(score, mode="strict"):

    mode = mode.lower()

    if mode == "strict":
        adjusted = score

    elif mode == "relaxed":
        adjusted = score * 1.25

    elif mode == "vacation":
        adjusted = score * 1.40

    else:
        adjusted = score

    return min(adjusted, 100)


# --------------------------------------------------
# Extract candidates from all pages
# --------------------------------------------------
def extract_all_candidates(pdf_path, mask_path, label):

    print(f"\nScanning {label}...")

    mask = cv2.imread(mask_path, cv2.IMREAD_GRAYSCALE)
    if mask is None:
        print(f"Mask {mask_path} not found")
        return []

    images = pdf_to_images(pdf_path)
    candidates = []

    for idx, page in enumerate(images, 1):

        gray = cv2.cvtColor(np.array(page), cv2.COLOR_RGB2GRAY)

        if gray.shape != mask.shape:
            print("Mask size mismatch — regenerate mask at same DPI")
            return []

        masked = cv2.bitwise_and(gray, gray, mask=mask)

        coords = cv2.findNonZero(mask)
        x, y, w, h = cv2.boundingRect(coords)
        crop = masked[y:y+h, x:x+w]

        cleaned = extract_signature_strokes(crop)

        if cleaned is None:
            continue

        print(f"{label} Page {idx} → candidate detected")

        candidates.append((idx, cleaned))

    return candidates


# --------------------------------------------------
# MAIN
# --------------------------------------------------
def main():

    MODE = "relaxed"  # strict | relaxed | vacation

    candidates1 = extract_all_candidates("file1ID.pdf", "mask_id.png", "file1ID")
    candidates2 = extract_all_candidates("file2PF3.pdf", "mask_insured.png", "file2PF")

    if not candidates1 or not candidates2:
        print("No valid signature candidates found.")
        return

    best_score = 0
    best_pair = None

    for idx1, sig1 in candidates1:
        for idx2, sig2 in candidates2:

            raw_score, norm1, norm2 = curve_similarity(sig1, sig2)
            adjusted_score = apply_match_mode(raw_score, MODE)

            print(f"Compare P{idx1} vs P{idx2} → Raw: {raw_score:.2f}% | Adjusted: {adjusted_score:.2f}%")

            if adjusted_score > best_score:
                best_score = adjusted_score
                best_pair = (idx1, idx2, norm1, norm2)

    if best_pair is None:
        print("No valid matches.")
        return

    idx1, idx2, norm1, norm2 = best_pair

    print("\n=== BEST MATCH ===")
    print(f"file1ID page {idx1}")
    print(f"file2PF page {idx2}")
    print(f"Final similarity ({MODE}): {best_score:.2f}%")

    cv2.imwrite("best_sig1.png", norm1)
    cv2.imwrite("best_sig2.png", norm2)

    combined = np.hstack([
        cv2.cvtColor(norm1, cv2.COLOR_GRAY2BGR),
        cv2.cvtColor(norm2, cv2.COLOR_GRAY2BGR)
    ])

    cv2.putText(
        combined,
        f"Similarity ({MODE}): {best_score:.2f}%",
        (20, 40),
        cv2.FONT_HERSHEY_SIMPLEX,
        1,
        (0, 0, 255),
        2
    )

    cv2.imwrite("best_signature_comparison.png", combined)


if __name__ == "__main__":
    main()
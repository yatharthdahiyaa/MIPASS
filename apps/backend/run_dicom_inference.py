"""
CLI Entrypoint for DICOM Inference — Zero Fallback Architecture.
Usage:
    python run_dicom_inference.py <path_to_dicom_file>
"""

import json
import os
import sys

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.services.dicom_service import analyze_dicom_image, is_valid_chest_image


def main():
    if len(sys.argv) < 2:
        print(json.dumps({
            "status": "error",
            "message": "Missing file argument. Please provide a DICOM (.dcm), PNG, or JPEG image path."
        }))
        sys.exit(1)

    filepath = sys.argv[1]
    if not os.path.exists(filepath):
        print(json.dumps({
            "status": "error",
            "message": f"File not found: {filepath}"
        }))
        sys.exit(1)

    filename = os.path.basename(filepath)
    with open(filepath, "rb") as f:
        file_bytes = f.read()

    is_valid, err = is_valid_chest_image(file_bytes, filename)
    if not is_valid:
        print(json.dumps({
            "status": "error",
            "message": err or "Only valid DICOM medical images (.dcm / .dicom) or standard radiographic images (.png / .jpg / .jpeg) are accepted."
        }))
        sys.exit(1)

    try:
        result = analyze_dicom_image(file_bytes, filename)
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({
            "status": "error",
            "message": f"Inference execution failed on trained model: {str(e)}"
        }))
        sys.exit(1)


if __name__ == "__main__":
    main()

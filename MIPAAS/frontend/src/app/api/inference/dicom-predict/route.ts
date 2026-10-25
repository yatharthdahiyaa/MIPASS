import { NextRequest, NextResponse } from "next/server";
import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import os from "os";

const execFileAsync = promisify(execFile);

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const serviceId = (formData.get("serviceId") as string) || "qxr";

    if (!file) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 400,
            message: "Medical image file is required. Please upload a DICOM (.dcm / .dicom) or standard image (.png, .jpg, .jpeg).",
          },
        },
        { status: 400 }
      );
    }

    // Only qXR has a real pretrained checkpoint wired into this build. Returning
    // a chest model result for a brain MRI, skin lesion, etc. would be unsafe and
    // misleading. These services remain available in the patient portal as
    // explicitly-labelled demo mode until validated checkpoints are added.
    if (serviceId !== "qxr") {
      return NextResponse.json(
        {
          success: false,
          demo_mode: true,
          model_availability: {
            available: false,
            mode: "unavailable",
            serviceId,
            message:
              "No trained model checkpoint is available for this service in this build. Use the qXR Chest X-Ray service for real inference, or use the patient portal demo mode with its explicit demo label.",
          },
          error: {
            code: 501,
            message:
              "This service has no trained model checkpoint in this build. It is not safe to apply the chest X-ray model to this scan type. Please use qXR Chest X-Ray or a validated clinical service.",
          },
        },
        { status: 501 }
      );
    }

    const filename = (file.name || "scan.dcm").toLowerCase();
    const validExtensions = [".dcm", ".dicom", ".png", ".jpg", ".jpeg", ".webp"];
    const isAllowed = validExtensions.some((ext) => filename.endsWith(ext));

    if (!isAllowed) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 400,
            message: "File is not a supported format. Please upload a Chest X-Ray in DICOM (.dcm), PNG, or JPEG format.",
          },
        },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);

    // 1. Try forwarding to running Flask backend on port 8080
    try {
      const backendFormData = new FormData();
      const mimeType = filename.endsWith(".png")
        ? "image/png"
        : filename.endsWith(".jpg") || filename.endsWith(".jpeg")
        ? "image/jpeg"
        : "application/dicom";
      const blob = new Blob([fileBuffer], { type: mimeType });
      backendFormData.append("file", blob, file.name);

      const backendRes = await fetch("http://127.0.0.1:8080/api/v1/inference/dicom-predict", {
        method: "POST",
        body: backendFormData,
        signal: AbortSignal.timeout(6000),
      });

      if (backendRes.ok) {
        const json = await backendRes.json();
        return NextResponse.json(json);
      }
    } catch {
      // Backend not running on 8080 or timed out; fall through to direct python CLI execution
    }

    // 2. Direct execution via Python script (ensures zero-downtime & guaranteed real trained weights)
    const tempDir = os.tmpdir();
    const tempFilePath = path.join(tempDir, `mipaas_upload_${Date.now()}_${path.basename(file.name)}`);

    try {
      await fs.writeFile(tempFilePath, fileBuffer);

      // Locate backend/run_dicom_inference.py
      // Note: frontend is in e:\PROJECTS\MIPAAS\MIPAAS\frontend, backend is in e:\PROJECTS\MIPAAS\MIPAAS\backend
      const scriptPath = path.resolve(process.cwd(), "..", "backend", "run_dicom_inference.py");

      const { stdout, stderr } = await execFileAsync("python", [scriptPath, tempFilePath], {
        maxBuffer: 50 * 1024 * 1024,
      });

      if (stderr && stderr.includes("Traceback")) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 500,
              message: `Model inference error: ${stderr}`,
            },
          },
          { status: 500 }
        );
      }

      // Parse JSON from stdout
      // Extract valid JSON object
      const jsonStart = stdout.indexOf("{");
      const jsonEnd = stdout.lastIndexOf("}");
      if (jsonStart === -1 || jsonEnd === -1) {
        throw new Error("Invalid output from inference engine");
      }

      const jsonStr = stdout.substring(jsonStart, jsonEnd + 1);
      const parsed = JSON.parse(jsonStr);

      if (parsed.status === "error") {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 400,
              message: parsed.message,
            },
          },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        data: parsed,
      });
    } finally {
      await fs.unlink(tempFilePath).catch(() => {});
    }
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 500,
          message: (err instanceof Error ? err.message : undefined) || "Internal server error during DICOM inference",
        },
      },
      { status: 500 }
    );
  }
}

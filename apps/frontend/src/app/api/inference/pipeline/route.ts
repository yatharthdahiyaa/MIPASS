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
    const patientId = (formData.get("patientId") as string) || "MIP-8842-X";
    const isSample = formData.get("isSample") === "true";

    // Path to the backend pipeline script
    const scriptPath = path.resolve(process.cwd(), "..", "backend", "run_diagnostic_pipeline.py");
    const sampleFilePath = path.resolve(process.cwd(), "..", "backend", "sample_cxr.dcm");

    let targetFilePath = "";
    let isTempFile = false;

    if (isSample) {
      targetFilePath = sampleFilePath;
    } else if (file) {
      const filename = (file.name || "study.dcm").toLowerCase();
      const validExtensions = [".dcm", ".dicom", ".png", ".jpg", ".jpeg", ".webp"];
      const isAllowed = validExtensions.some((ext) => filename.endsWith(ext));

      if (!isAllowed) {
        return NextResponse.json(
          {
            status: "rejected",
            error: {
              code: 400,
              message: "Unsupported file format. Please upload a medical imaging study in DICOM (.dcm / .dicom) or standard radiographic formats (.png, .jpg, .jpeg).",
            },
          },
          { status: 400 }
        );
      }

      const arrayBuffer = await file.arrayBuffer();
      const fileBuffer = Buffer.from(arrayBuffer);
      const tempDir = os.tmpdir();
      targetFilePath = path.join(tempDir, `mipaas_pipeline_${Date.now()}_${path.basename(file.name)}`);
      await fs.writeFile(targetFilePath, fileBuffer);
      isTempFile = true;
    } else {
      return NextResponse.json(
        {
          status: "error",
          error: {
            code: 400,
            message: "Missing medical study file. Provide a valid DICOM or radiographic image file, or request the demo study.",
          },
        },
        { status: 400 }
      );
    }

    try {
      const { stdout, stderr } = await execFileAsync(
        "python",
        [scriptPath, targetFilePath, serviceId, patientId],
        {
          maxBuffer: 64 * 1024 * 1024,
        }
      );

      // Clean up temp file if created
      if (isTempFile) {
        try {
          await fs.unlink(targetFilePath);
        } catch {}
      }

      // Find the JSON output from stdout
      const lines = stdout.trim().split("\n");
      const jsonLine = lines.find((line) => line.trim().startsWith("{") && line.trim().endsWith("}")) || lines[lines.length - 1];

      try {
        const parsed = JSON.parse(jsonLine.trim());
        return NextResponse.json(parsed);
      } catch (jsonErr) {
        return NextResponse.json(
          {
            status: "error",
            message: "Failed to parse pipeline engine output.",
            raw: stdout,
            stderr: stderr,
          },
          { status: 500 }
        );
      }
    } catch (execErr) {
      if (isTempFile) {
        try {
          await fs.unlink(targetFilePath);
        } catch {}
      }
      return NextResponse.json(
        {
          status: "error",
          message: `7-Agent Diagnostic Pipeline execution failed: ${execErr instanceof Error ? execErr.message : String(execErr)}`,
        },
        { status: 500 }
      );
    }
  } catch (err) {
    return NextResponse.json(
      {
        status: "error",
        message: `Internal server error: ${err instanceof Error ? err.message : String(err)}`,
      },
      { status: 500 }
    );
  }
}

# Chest X-ray model

The platform reads chest X-rays with the CheXpert ensemble in `ml/chexpert_ensemble.pth`.

## What it is

| | |
|---|---|
| File | `ml/chexpert_ensemble.pth` (456 MB, not in git). Override with `MIPAAS_CXR_CHECKPOINT` |
| Findings | Cardiomegaly, Lung Opacity, Edema, Consolidation, Atelectasis, Pleural Effusion, Support Devices |
| Networks | DenseNet-121 (512 px), EfficientNetV2-S (512 px), RAD-DINO ViT-B/14 (518 px), about 114M parameters in total |
| Combination | Each network scores the image and its mirror image; the result is the mean of the six probabilities |
| Thresholds | One per finding, stored in the checkpoint, fitted on the training run's tune split with Youden's J |
| Created | 2026-11-05 |

It does **not** assess pneumothorax, nodules, masses or fractures. Every reading says so.

## Where it runs

- **Backend** (`apps/backend`): `app/services/cxr_ensemble.py` loads the networks and scores
  images. `app/services/dicom_service.py` turns the scores into a reading. It serves the
  `chest_xray` analyser for doctors' studies (desktop app) and patients' X-ray uploads (web).
- **Chat assistant** (`apps/agents/XAI`): an identical copy in `XAI/ensemble.py` produces the
  scores and attention maps behind the X-ray attachment in the patient chat. A test fails if the
  two copies differ.

## How a reading is made

1. **Pixels.**
   - DICOM: the modality and VOI look-up tables (the window the scanner set) are applied, and
     MONOCHROME1 is inverted.
   - Other formats are read as 8-bit grayscale.
   - Everything is then scaled so the 0.5th to 99.5th percentile spans 0 to 255.
2. **Scores.** Each network gets the image resized to its own input size, copied to three
   channels and normalised.
3. **Findings.** A finding is flagged when its score reaches its threshold. Certainty follows from
   how far above the threshold it is: under 1.15 times is "low", up to 1.5 times "moderate",
   beyond that "high".
4. **Severity.**
   - **HIGH:** an acute finding (lung opacity, oedema, consolidation or pleural effusion) at
     moderate certainty or more.
   - **MODERATE:** anything else flagged, or a finding within 15% of its threshold.
   - **NORMAL:** otherwise.
   - **CRITICAL** is never used: the model can't see the findings that are emergencies.
   - Support devices are reported but are not a finding.
5. **Attention map.** Grad-CAM for the strongest flagged finding, from the DenseNet-121 member. It
   shows where that network looked, not the whole ensemble.
6. **Text.** The reading names what was flagged and how confidently. It suggests follow-up for the
   reviewing clinician, never treatment, and never says something the model doesn't assess is
   absent.

## Settings the checkpoint doesn't record

The training code's input normalisation and RAD-DINO's pooling were not saved in the checkpoint,
so they were determined by comparing candidates on labelled public images:
- **Images:** 18 normal and 60 pneumonia frontal films from the open COVID-19 chest X-ray dataset
  (ieee8023), plus NIH ChestX-ray14 image `00000001_000` (labelled cardiomegaly).
- **Score used:** how well each variant separates pneumonia from normal (ROC AUC).

| Member | ImageNet mean/std | [-1, 1] | RAD-DINO mean/std |
|---|---|---|---|
| DenseNet-121, lung opacity AUC | **0.767** | 0.752 | 0.762 |
| EfficientNetV2-S, lung opacity AUC | **0.820** | 0.804 | 0.807 |
| RAD-DINO [CLS, patch mean], lung opacity AUC | 0.832 | 0.832 | 0.831 |
| RAD-DINO [patch mean, CLS] | 0.794 | 0.795 | 0.788 |

- **Chosen:** ImageNet normalisation for all three (`MEMBER_NORMALISATION` in `cxr_ensemble.py`),
  and RAD-DINO features pooled as [CLS token, mean of patch tokens].
- **Confidence:** the pooling order is clear-cut. The normalisation choice is a small, consistent
  edge on a small set.
- **If you have the training code,** check its transforms and update `MEMBER_NORMALISATION` if they
  differ.

## How it behaved on public images (not a clinical validation)

Same 78 images, full ensemble:
- **Separation:** pneumonia vs normal, lung opacity AUC 0.81, consolidation 0.79.
- **Pneumonia films:** consolidation was flagged on 75% and lung opacity on 67%.
- **Normal films:**
  - At least one finding was flagged on 9 of 18.
  - Five of those were marginal (1.03 to 1.08 times the threshold).
  - The strong ones were mostly supine AP films, where the heart looks larger and the dataset's
    "no finding" label is less reliable.
  - The Youden thresholds favour sensitivity, so with six findings a normal film often grazes one.
- **Speed:** about 5 to 10 seconds per film on a laptop CPU. The first reading after start-up also
  loads the model.

This dataset is small and differs from CheXpert. The model needs a proper evaluation on data like
your patients' before anyone relies on it (see `docs/LAUNCH_CHECKLIST.md`).

## Replacing the model

- **Same format** (`format_version` 1, members named `densenet121`, `tf_efficientnetv2_s`, `rad_dino`):
  replace the file and restart.
- **Anything else:** add or adjust a builder in `cxr_ensemble.py`, copy the file to
  `apps/agents/XAI/ensemble.py`, and run both test suites.
- **Loading is strict:** a checkpoint that doesn't match the architecture exactly fails to load
  instead of producing wrong scores. Studies wait as "pending" until a working model is in place.

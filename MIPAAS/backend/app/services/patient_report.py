"""
Plain-language patient report builder for the MiPAAS diagnostic pipeline.

The goal is to turn a model probability plus a Grad-CAM zone analysis into a
structured report that a patient can understand:

  * what was found (or that nothing high-confidence was found),
  * where on the image the AI looked and what that means for left/right,
  * possible causes (explicitly "possible", never confirmed),
  * how urgent it is,
  * what tests / specialists may come next,
  * red-flag symptoms,
  * questions to ask the doctor.

It deliberately does NOT claim that an X-ray (or any single scan) can prove the
root cause.  A scan shows patterns; the cause needs clinical correlation.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional


# ─────────────────────────────────────────────────────────────────────
# Common safety content
# ─────────────────────────────────────────────────────────────────────

COMMON_RED_FLAGS: List[str] = [
    "Severe shortness of breath at rest, or breathing that is getting worse quickly",
    "Sudden or crushing chest pain",
    "Coughing up blood",
    "Blue lips, blue fingertips, or cold and clammy skin",
    "Fainting, confusion, or difficulty staying awake",
    "Fever with shaking chills",
]

# Service-specific emergency warning signs.  A skin or foot report should not
# tell a patient to watch for chest pain as if that were the main red flag for
# that study.  qXR/tb/lung-cancer still use the chest list below.
SERVICE_RED_FLAGS: Dict[str, List[str]] = {
    "tb": COMMON_RED_FLAGS + [
        "A cough lasting more than 2–3 weeks",
        "Unexplained weight loss",
        "Night sweats or fevers that keep coming back",
    ],
    "lung-cancer": COMMON_RED_FLAGS + [
        "A new or changing cough lasting more than 3 weeks",
        "Unexplained weight loss",
        "Hoarseness or difficulty swallowing",
    ],
    "brain-tumor": [
        "Sudden weakness or numbness on one side of the face, arm, or leg",
        "Sudden confusion, trouble speaking, or difficulty understanding speech",
        "Sudden vision loss or double vision",
        "A new seizure or convulsion",
        "A severe headache that comes on suddenly or keeps getting worse",
        "Drowsiness, fainting, or difficulty staying awake",
        "New vomiting with headache or neck stiffness",
    ],
    "stroke": [
        "Sudden face drooping, especially on one side",
        "Sudden arm or leg weakness, especially on one side",
        "Sudden trouble speaking or understanding speech",
        "Sudden vision loss, double vision, or severe dizziness",
        "Sudden severe headache with no known cause",
        "Sudden loss of balance or difficulty walking",
    ],
    "qer": [
        "Sudden weakness or numbness on one side of the body",
        "Sudden confusion, trouble speaking, or difficulty waking up",
        "A new seizure or convulsion",
        "A severe headache that comes on suddenly or keeps getting worse",
        "Repeated vomiting after a head injury",
        "Clear fluid or blood coming from the nose or ear after a head injury",
    ],
    "cardiac": [
        "Chest pain or pressure, especially if it spreads to the arm, jaw, or back",
        "Severe shortness of breath or difficulty breathing at rest",
        "Fainting or near-fainting",
        "A racing, pounding, or irregular heartbeat with dizziness or chest pain",
        "Sudden swelling of the legs or abdomen with rapid weight gain",
    ],
    "skin-cancer": [
        "A mole or spot that is changing in size, shape, or colour",
        "A sore that does not heal after a few weeks",
        "A mole that bleeds, itches, crusts, or becomes painful",
        "A new dark streak under a nail",
        "A firm, raised lump that is growing",
        "A rough, scaly skin patch that keeps coming back",
    ],
    "diabetic-foot": [
        "A new blister, cut, or ulcer on the foot that is not healing",
        "Redness, warmth, swelling, or pus spreading from a foot wound",
        "Black or dead-looking tissue on the foot or toes",
        "Sudden severe foot pain or loss of feeling",
        "Fever with a foot wound",
        "New coldness, pale skin, or absent pulses in the foot",
    ],
}

COMMON_QUESTIONS: List[str] = [
    "What is the most likely cause of this finding?",
    "Do I need more tests, such as a CT scan, ultrasound, or blood tests?",
    "Should I see a specialist? How soon?",
    "What symptoms should make me go to the emergency department?",
    "Could this be related to my other health conditions or medicines?",
    "When should I have a follow-up appointment or repeat test?",
]


# Zones where each chest finding is typically seen.  Used only to check
# whether the heatmap focus is anatomically plausible for the candidate
# finding; it is not used to create the location.
EXPECTED_CHEST_ZONES: Dict[str, set] = {
    "Atelectasis": {"lower_image_left", "lower_image_right", "lower_central"},
    "Consolidation": {
        "upper_image_left", "upper_image_right",
        "middle_image_left", "middle_image_right",
        "lower_image_left", "lower_image_right",
    },
    "Infiltration": {
        "upper_image_left", "upper_image_right",
        "middle_image_left", "middle_image_right",
        "lower_image_left", "lower_image_right",
    },
    "Pneumothorax": {"upper_image_left", "upper_image_right"},
    "Edema": {
        "middle_central", "lower_central",
        "middle_image_left", "middle_image_right",
        "lower_image_left", "lower_image_right",
    },
    "Emphysema": {
        "upper_image_left", "upper_image_right",
        "middle_image_left", "middle_image_right",
    },
    "Fibrosis": {
        "middle_image_left", "middle_image_right",
        "lower_image_left", "lower_image_right",
    },
    "Effusion": {"lower_image_left", "lower_image_right"},
    "Pneumonia": {
        "upper_image_left", "upper_image_right",
        "middle_image_left", "middle_image_right",
        "lower_image_left", "lower_image_right",
    },
    "Pleural_Thickening": {
        "upper_image_left", "upper_image_right",
        "middle_image_left", "middle_image_right",
        "lower_image_left", "lower_image_right",
    },
    "Cardiomegaly": {"middle_central", "lower_central"},
    "Nodule": {
        "upper_image_left", "upper_image_right",
        "middle_image_left", "middle_image_right",
        "lower_image_left", "lower_image_right",
    },
    "Mass": {
        "upper_image_left", "upper_image_right",
        "middle_image_left", "middle_image_right",
        "lower_image_left", "lower_image_right",
    },
    "Hernia": {"middle_central", "lower_central"},
    "Lung Lesion": {
        "upper_image_left", "upper_image_right",
        "middle_image_left", "middle_image_right",
        "lower_image_left", "lower_image_right",
    },
    "Fracture": {
        "upper_image_left", "upper_image_right",
        "middle_image_left", "middle_image_right",
        "lower_image_left", "lower_image_right",
    },
    "Lung Opacity": {
        "upper_image_left", "upper_image_right",
        "middle_image_left", "middle_image_right",
        "lower_image_left", "lower_image_right",
    },
    "Enlarged Cardiomediastinum": {"upper_central", "middle_central"},
}


# ─────────────────────────────────────────────────────────────────────
# Chest X-ray pathology guides (TorchXRayVision 18-class vocabulary)
# ─────────────────────────────────────────────────────────────────────

PATHOLOGY_PATIENT_GUIDES: Dict[str, Dict[str, Any]] = {
    "Atelectasis": {
        "simple_name": "a partially collapsed lung",
        "what_it_is": (
            "Atelectasis means that a small or large part of the lung has not fully "
            "expanded, so less air reaches that area. It is not a disease by itself; "
            "it is a sign that something is blocking or pressing on the airway."
        ),
        "possible_causes": [
            "Mucus plugging or a blocked airway",
            "Shallow breathing after surgery, pain, or prolonged bed rest",
            "Pressure from fluid or air around the lung",
            "A lung infection such as pneumonia",
            "A tumour or enlarged lymph node blocking an airway (less common)",
        ],
        "next_steps": [
            "Your doctor will examine your breathing and may compare this scan with old X-rays.",
            "They may ask you to do deep-breathing exercises or use an incentive spirometer.",
            "If the cause is not clear, they may order a CT scan or bronchoscopy.",
        ],
        "red_flags": [
            "Severe breathlessness at rest",
            "Chest pain, especially sudden or crushing pain",
            "Coughing up blood",
            "Blue lips or fingertips",
            "Fainting or confusion",
        ],
        "questions": [
            "What is the most likely cause of the collapsed area?",
            "Do I need a CT scan or bronchoscopy?",
            "What breathing exercises should I do?",
            "When should I have a follow-up X-ray?",
        ],
    },
    "Consolidation": {
        "simple_name": "a patch of lung that looks filled or solid",
        "what_it_is": (
            "Consolidation means the tiny air sacs in part of the lung are filled with "
            "fluid, pus, or cells instead of air. On an X-ray it looks like a white patch."
        ),
        "possible_causes": [
            "Pneumonia (infection)",
            "Fluid in the lung from heart failure",
            "Inflammation or bleeding",
            "Aspiration (food or liquid going into the airway)",
            "Less commonly, a tumour",
        ],
        "next_steps": [
            "Your doctor will check your temperature, oxygen level, breathing sounds, and blood tests.",
            "They may order a repeat X-ray or CT scan, and sputum tests if infection is suspected.",
            "Treatment depends on the cause; bacterial pneumonia is treated with antibiotics.",
        ],
        "red_flags": [
            "Severe breathlessness",
            "Fever with shaking chills",
            "Chest pain",
            "Coughing up blood",
            "Blue lips or fingertips",
        ],
        "questions": [
            "Is this infection, fluid, or something else?",
            "Do I need antibiotics or other treatment?",
            "Should I have a repeat X-ray after treatment?",
            "What symptoms should make me come back sooner?",
        ],
    },
    "Infiltration": {
        "simple_name": "cloudy areas in the lung",
        "what_it_is": (
            "Infiltration is a general word for extra fluid or cells in the lung tissue. "
            "It can be caused by infection, inflammation, or fluid."
        ),
        "possible_causes": [
            "Chest infection or pneumonia",
            "Fluid from heart or kidney problems",
            "Inflammation from smoking or irritants",
            "Less commonly, a tumour",
        ],
        "next_steps": [
            "Your doctor will combine this with your symptoms and may order blood tests.",
            "A repeat or CT scan may be needed if the shadow does not clear.",
            "Treatment depends on the cause.",
        ],
        "red_flags": [
            "Severe breathlessness",
            "Fever with shaking chills",
            "Chest pain",
            "Coughing up blood",
            "Blue lips or fingertips",
        ],
        "questions": [
            "What is causing the cloudy area?",
            "Do I need antibiotics or more tests?",
            "When should the X-ray be repeated?",
            "Could this be related to smoking?",
        ],
    },
    "Pneumothorax": {
        "simple_name": "air around the lung (a collapsed lung)",
        "what_it_is": (
            "A pneumothorax happens when air leaks into the space between the lung and "
            "the chest wall. The air pushes on the lung and can make it collapse."
        ),
        "possible_causes": [
            "A rib injury or chest trauma",
            "Lung disease such as COPD or emphysema",
            "A medical procedure on the chest",
            "Sometimes it happens without a clear cause (spontaneous)",
        ],
        "next_steps": [
            "A small pneumothorax may be watched with repeat X-rays and oxygen.",
            "A larger one may need a needle or chest tube to remove the air.",
            "You should not fly or dive until your doctor says it is safe.",
        ],
        "red_flags": [
            "Sudden severe chest pain",
            "Sudden shortness of breath",
            "Rapid heartbeat",
            "Blue lips or fingertips",
            "Feeling faint or confused",
        ],
        "questions": [
            "How large is the pneumothorax?",
            "Do I need a chest tube or can it be watched?",
            "When can I fly or exercise again?",
            "Will it happen again?",
        ],
    },
    "Edema": {
        "simple_name": "fluid in the lungs",
        "what_it_is": (
            "Pulmonary edema means fluid has leaked into the lung tissue. It makes it "
            "harder for oxygen to pass into the blood."
        ),
        "possible_causes": [
            "Heart failure or a weak heart pump",
            "Kidney disease or too much fluid in the body",
            "High blood pressure or valve problems",
            "Severe infection or inflammation",
        ],
        "next_steps": [
            "Your doctor will check your oxygen, weight, heart, and kidney function.",
            "They may order an echocardiogram, chest CT, or blood tests.",
            "Treatment may include diuretics (water pills) and treating the underlying cause.",
        ],
        "red_flags": [
            "Severe breathlessness, especially lying flat",
            "Pink or frothy sputum",
            "Chest pain",
            "Rapid weight gain or swelling in the legs",
            "Blue lips or fingertips",
        ],
        "questions": [
            "Is this caused by my heart, kidneys, or something else?",
            "Do I need a water pill or other medicine?",
            "How much fluid should I drink?",
            "What weight gain should I report?",
        ],
    },
    "Emphysema": {
        "simple_name": "damage to the air sacs (COPD)",
        "what_it_is": (
            "Emphysema is permanent damage to the tiny air sacs in the lungs. It makes "
            "the lungs less able to move air out and causes breathlessness."
        ),
        "possible_causes": [
            "Smoking (the most common cause)",
            "Long-term exposure to dust, smoke, or fumes",
            "A rare genetic condition (alpha-1 antitrypsin deficiency)",
        ],
        "next_steps": [
            "Your doctor may order breathing tests (spirometry) and a CT scan.",
            "Stopping smoking is the most important step.",
            "Pulmonary rehabilitation, inhalers, and vaccines can help.",
        ],
        "red_flags": [
            "Breathlessness that suddenly gets worse",
            "Fever or chest pain",
            "Coughing up blood",
            "Confusion or extreme tiredness",
            "Blue lips or fingertips",
        ],
        "questions": [
            "Do I have COPD?",
            "What inhalers or rehabilitation should I start?",
            "How can I stop smoking?",
            "Do I need oxygen at home?",
        ],
    },
    "Fibrosis": {
        "simple_name": "scarring in the lung",
        "what_it_is": (
            "Pulmonary fibrosis is scarring of the lung tissue. Scar tissue is stiff and "
            "makes it harder for oxygen to pass into the blood."
        ),
        "possible_causes": [
            "Long-standing inflammation or infection",
            "Autoimmune diseases such as rheumatoid arthritis",
            "Exposure to asbestos, silica, or certain drugs",
            "Sometimes no clear cause (idiopathic pulmonary fibrosis)",
        ],
        "next_steps": [
            "Your doctor may order a high-resolution CT, breathing tests, and blood tests.",
            "A lung specialist may be needed.",
            "Treatment can slow the scarring and manage symptoms.",
        ],
        "red_flags": [
            "Breathlessness that gets worse quickly",
            "Fever or new chest pain",
            "Coughing up blood",
            "Blue lips or fingertips",
            "Confusion",
        ],
        "questions": [
            "What is causing the scarring?",
            "Do I need a lung biopsy or autoimmune tests?",
            "What treatments can slow it down?",
            "Should I see a lung specialist?",
        ],
    },
    "Effusion": {
        "simple_name": "fluid around the lung",
        "what_it_is": (
            "A pleural effusion is fluid in the space between the lung and the chest wall. "
            "It can press on the lung and make breathing harder."
        ),
        "possible_causes": [
            "Heart failure",
            "Pneumonia or other infection",
            "Kidney or liver disease",
            "Cancer",
            "Recent surgery or injury",
        ],
        "next_steps": [
            "Your doctor may order an ultrasound or CT scan.",
            "They may remove a small sample of fluid with a needle (thoracentesis) to find the cause.",
            "Treatment depends on the cause; sometimes a drain is needed.",
        ],
        "red_flags": [
            "Severe breathlessness",
            "Chest pain",
            "Fever",
            "Coughing up blood",
            "Blue lips or fingertips",
        ],
        "questions": [
            "What is causing the fluid?",
            "Do I need a needle test or a drain?",
            "Will the fluid come back?",
            "Should I see a lung or heart specialist?",
        ],
    },
    "Pneumonia": {
        "simple_name": "a chest infection",
        "what_it_is": (
            "Pneumonia is an infection of the lung tissue. The air sacs fill with pus and "
            "fluid, which makes breathing harder and can cause fever and cough."
        ),
        "possible_causes": [
            "Bacteria (most common)",
            "Viruses, including flu and COVID-19",
            "Fungi (more common in people with weak immunity)",
            "Aspiration of food or liquid",
        ],
        "next_steps": [
            "Your doctor will check oxygen, blood tests, and may order sputum tests.",
            "Bacterial pneumonia is treated with antibiotics.",
            "A repeat X-ray may be needed after treatment, especially if you smoke or are older.",
        ],
        "red_flags": [
            "Severe breathlessness",
            "Fever with shaking chills",
            "Chest pain",
            "Confusion",
            "Blue lips or fingertips",
        ],
        "questions": [
            "Is this bacterial or viral?",
            "Do I need antibiotics?",
            "When should I have a repeat X-ray?",
            "Do I need a pneumonia vaccine?",
        ],
    },
    "Pleural_Thickening": {
        "simple_name": "thickening of the lung lining",
        "what_it_is": (
            "Pleural thickening is scarring or inflammation of the thin lining around the "
            "lung. It can be a leftover sign of past infection or exposure."
        ),
        "possible_causes": [
            "Past infection or pneumonia",
            "Asbestos exposure",
            "Inflammation from autoimmune disease",
            "Prior chest surgery or trauma",
        ],
        "next_steps": [
            "Your doctor will compare with old X-rays.",
            "A CT scan may be needed to look at the pleura more clearly.",
            "Most cases are monitored; treatment depends on the cause.",
        ],
        "red_flags": [
            "New or worsening breathlessness",
            "Chest pain",
            "Fever",
            "Coughing up blood",
            "Weight loss",
        ],
        "questions": [
            "Is this from an old infection or another cause?",
            "Do I need a CT scan?",
            "Should I be checked for asbestos exposure?",
            "Will it change over time?",
        ],
    },
    "Cardiomegaly": {
        "simple_name": "an enlarged heart shadow",
        "what_it_is": (
            "Cardiomegaly means the heart looks larger than expected on the X-ray. It can "
            "be due to a truly enlarged heart or to the way the X-ray was taken."
        ),
        "possible_causes": [
            "High blood pressure",
            "Heart valve disease",
            "Heart muscle weakness (cardiomyopathy)",
            "Fluid overload or kidney disease",
            "Sometimes a normal variant or positioning",
        ],
        "next_steps": [
            "Your doctor will check your blood pressure, heart sounds, and swelling.",
            "An echocardiogram (heart ultrasound) is often needed.",
            "Treatment depends on the cause.",
        ],
        "red_flags": [
            "Chest pain",
            "Severe breathlessness",
            "Fainting",
            "Rapid or irregular heartbeat",
            "Swelling in the legs that gets worse",
        ],
        "questions": [
            "Is my heart truly enlarged or is this positioning?",
            "Do I need an echocardiogram?",
            "Is this related to my blood pressure?",
            "What symptoms should I watch for?",
        ],
    },
    "Nodule": {
        "simple_name": "a small spot in the lung",
        "what_it_is": (
            "A lung nodule is a small rounded spot in the lung. Most nodules are benign, "
            "but some can be an early cancer. Size, shape, and change over time matter."
        ),
        "possible_causes": [
            "A healed infection or scar",
            "A benign growth",
            "An early lung cancer (less common, but important to check)",
            "Inflammation",
        ],
        "next_steps": [
            "Your doctor will compare with old scans and may order a CT scan.",
            "Small nodules are often watched with repeat scans.",
            "If the nodule is large or changing, a biopsy or PET scan may be needed.",
        ],
        "red_flags": [
            "Coughing up blood",
            "New or worsening breathlessness",
            "Chest pain",
            "Unexplained weight loss",
            "Fever",
        ],
        "questions": [
            "How big is the nodule and what does it look like?",
            "Do I need a CT scan or PET scan?",
            "When should it be checked again?",
            "What is the chance it is cancer?",
        ],
    },
    "Mass": {
        "simple_name": "a larger abnormal area in the lung",
        "what_it_is": (
            "A mass is a larger abnormal area or growth in the lung. It needs careful "
            "evaluation because it can be benign or malignant."
        ),
        "possible_causes": [
            "Lung cancer",
            "A benign tumour",
            "A large infection or abscess",
            "A collection of fluid or inflammation",
        ],
        "next_steps": [
            "A CT scan is usually needed.",
            "Your doctor may recommend a PET scan, bronchoscopy, or biopsy.",
            "A lung specialist and, if needed, an oncology team will be involved.",
        ],
        "red_flags": [
            "Coughing up blood",
            "Unexplained weight loss",
            "Severe breathlessness",
            "Chest pain",
            "Hoarseness or trouble swallowing",
        ],
        "questions": [
            "What is the size and shape of the mass?",
            "Do I need a biopsy or PET scan?",
            "Should I see a lung specialist urgently?",
            "What are the treatment options if it is cancer?",
        ],
    },
    "Hernia": {
        "simple_name": "part of the stomach or bowel pushing into the chest",
        "what_it_is": (
            "A diaphragmatic hernia happens when part of the stomach or bowel moves up "
            "through the diaphragm into the chest. It can cause heartburn, chest pain, or "
            "breathing problems."
        ),
        "possible_causes": [
            "A gap or weakness in the diaphragm",
            "Injury or surgery",
            "Increased pressure in the abdomen",
            "Some hernias are present from birth",
        ],
        "next_steps": [
            "Your doctor may order a CT scan or barium swallow.",
            "Small hernias may be watched.",
            "Surgery may be needed if symptoms are severe or the bowel is trapped.",
        ],
        "red_flags": [
            "Severe chest or upper abdominal pain",
            "Vomiting that will not stop",
            "Unable to swallow",
            "Severe breathlessness",
            "Fever",
        ],
        "questions": [
            "How large is the hernia?",
            "Do I need surgery?",
            "What foods or habits should I change?",
            "What symptoms mean the hernia is trapped?",
        ],
    },
    "Lung Lesion": {
        "simple_name": "an abnormal area in the lung",
        "what_it_is": (
            "A lung lesion is a general term for an abnormal area in the lung. It can be "
            "infection, inflammation, a scar, or a growth."
        ),
        "possible_causes": [
            "Infection or pneumonia",
            "Scar from an old infection",
            "A benign growth",
            "Lung cancer (less common, but needs to be checked)",
        ],
        "next_steps": [
            "Your doctor will compare with old scans and may order a CT scan.",
            "A PET scan or biopsy may be needed if it looks suspicious.",
            "Follow-up imaging is common.",
        ],
        "red_flags": [
            "Coughing up blood",
            "Unexplained weight loss",
            "Chest pain",
            "Severe breathlessness",
            "Fever",
        ],
        "questions": [
            "What does the lesion look like?",
            "Do I need a CT scan or biopsy?",
            "When should it be checked again?",
            "Could it be cancer?",
        ],
    },
    "Fracture": {
        "simple_name": "a broken rib or collarbone",
        "what_it_is": (
            "A fracture is a break in a bone, such as a rib or collarbone. Rib fractures "
            "can make breathing painful and increase the risk of pneumonia."
        ),
        "possible_causes": [
            "A fall or direct blow to the chest",
            "A car accident",
            "Severe coughing (rare)",
            "Weak bones (osteoporosis)",
        ],
        "next_steps": [
            "Your doctor will examine you and may order a CT scan to see the fracture better.",
            "Most rib fractures heal with pain control, deep breathing, and time.",
            "You may need follow-up to make sure the lung is not injured.",
        ],
        "red_flags": [
            "Severe breathlessness",
            "Chest pain that gets worse",
            "Coughing up blood",
            "Fever",
            "A crunching feeling or deformity in the chest",
        ],
        "questions": [
            "Which bone is broken?",
            "Do I need a CT scan?",
            "What pain medicine is safe?",
            "When can I return to normal activity?",
        ],
    },
    "Lung Opacity": {
        "simple_name": "a cloudy area in the lung",
        "what_it_is": (
            "Lung opacity is a general term for cloudiness on the X-ray. It can be caused "
            "by infection, fluid, inflammation, or a growth."
        ),
        "possible_causes": [
            "Pneumonia or other infection",
            "Fluid in the lung",
            "Inflammation or scarring",
            "A tumour or nodule",
        ],
        "next_steps": [
            "Your doctor will combine this with your symptoms and may order a CT scan.",
            "A repeat X-ray may be needed after treatment.",
            "Treatment depends on the cause.",
        ],
        "red_flags": [
            "Severe breathlessness",
            "Fever with shaking chills",
            "Chest pain",
            "Coughing up blood",
            "Blue lips or fingertips",
        ],
        "questions": [
            "What is causing the cloudy area?",
            "Do I need a CT scan?",
            "Should I have a repeat X-ray?",
            "Do I need antibiotics?",
        ],
    },
    "Enlarged Cardiomediastinum": {
        "simple_name": "a wider central chest shadow",
        "what_it_is": (
            "The cardiomediastinal shadow is the central part of the chest X-ray that "
            "includes the heart, blood vessels, lymph nodes, and other structures. If it "
            "looks wider than usual, it may be due to the heart, vessels, lymph nodes, or "
            "simply the way the X-ray was taken."
        ),
        "possible_causes": [
            "An enlarged heart or blood vessels",
            "Enlarged lymph nodes",
            "Aortic aneurysm or vascular enlargement",
            "Positioning or a portable X-ray technique",
            "Fluid or fat in the mediastinum",
        ],
        "next_steps": [
            "Your doctor will compare with old X-rays and examine you.",
            "A CT scan of the chest may be needed to see the mediastinum clearly.",
            "An echocardiogram may be needed if the heart is enlarged.",
        ],
        "red_flags": [
            "Chest pain",
            "Severe breathlessness",
            "Trouble swallowing",
            "Hoarseness",
            "Swelling of the face or neck",
        ],
        "questions": [
            "Is the widening real or due to positioning?",
            "Do I need a CT scan?",
            "Is my heart or aorta involved?",
            "What symptoms should I watch for?",
        ],
    },
}


# ─────────────────────────────────────────────────────────────────────
# Generic helpers
# ─────────────────────────────────────────────────────────────────────

GENERIC_GUIDE: Dict[str, Any] = {
    "simple_name": "an abnormal pattern",
    "what_it_is": (
        "The AI flagged a pattern that is not specific to one disease. A scan shows "
        "patterns, not causes; your doctor will interpret it together with your symptoms "
        "and other tests."
    ),
    "possible_causes": [
        "Infection or inflammation",
        "Fluid or scarring",
        "A benign growth or structural change",
        "Other conditions your doctor will consider",
    ],
    "next_steps": [
        "Discuss this result with your doctor.",
        "They may compare it with older scans or order a follow-up test.",
        "Treatment depends on the cause, not on the scan alone.",
    ],
    "red_flags": list(COMMON_RED_FLAGS),
    "questions": list(COMMON_QUESTIONS),
}


def _unique(items: List[str]) -> List[str]:
    seen = set()
    out = []
    for item in items:
        key = item.strip().lower()
        if key and key not in seen:
            seen.add(key)
            out.append(item)
    return out


def _severity_sentence(severity: str, has_high_confidence: bool) -> str:
    sev = (severity or "").upper()
    if not has_high_confidence:
        return (
            "There is no high-confidence emergency finding on this scan. That does not "
            "mean every symptom is harmless; if you feel very unwell, seek care."
        )
    if sev == "CRITICAL":
        return (
            "This finding can be serious and needs urgent medical review. Please contact "
            "your doctor or an emergency service now, especially if you have any red-flag "
            "symptoms."
        )
    if sev == "HIGH":
        return (
            "This finding needs prompt medical review. It is not necessarily an emergency, "
            "but it should not be ignored."
        )
    if sev == "MODERATE":
        return (
            "This is a borderline / moderate finding. It needs clinical correlation and "
            "possibly a follow-up test."
        )
    return (
        "No urgent abnormality was detected by the AI. Routine follow-up is still "
        "important if you have symptoms."
    )


def _zone_block(zone_analysis: Optional[Dict[str, Any]], modality: str) -> Dict[str, Any]:
    if not zone_analysis:
        return {
            "available": False,
            "explanation": (
                "A heatmap location could not be calculated for this scan. The AI result "
                "should therefore be interpreted as a whole-image pattern, not a precise "
                "location."
            ),
        }

    dominant_label = zone_analysis.get("dominant_zone_label") or "an area of the image"
    share = zone_analysis.get("dominant_share_pct")
    localized = bool(zone_analysis.get("is_localized"))
    if localized:
        explanation = (
            f"The warm colours on the heatmap were strongest in the {dominant_label}. "
            f"That zone contained about {share}% of the strongest AI activation. "
            "This is where the model paid the most attention while making its decision."
        )
    else:
        explanation = (
            f"The heatmap activation was spread across several areas. The strongest focus "
            f"was in the {dominant_label}, but no single zone clearly dominated. Treat the "
            "location as approximate."
        )

    return {
        "available": True,
        "dominant_zone": zone_analysis.get("dominant_zone"),
        "dominant_zone_label": dominant_label,
        "dominant_short_label": zone_analysis.get("dominant_short_label"),
        "dominant_share_pct": share,
        "activation_share_pct": zone_analysis.get("dominant_activation_share_pct"),
        "image_side": zone_analysis.get("image_side"),
        "patient_side": zone_analysis.get("patient_side"),
        "is_localized": localized,
        "localization_confidence": zone_analysis.get("localization_confidence"),
        "explanation": explanation,
        "laterality_note": zone_analysis.get("laterality_note"),
        "method": zone_analysis.get("method"),
        "zones": zone_analysis.get("zones", []),
        "modality": modality,
    }


# ─────────────────────────────────────────────────────────────────────
# Main builder
# ─────────────────────────────────────────────────────────────────────

def build_patient_report(
    *,
    service_name: str,
    modality: str,
    primary_name: Optional[str],
    primary_prob: Optional[float],
    severity: str,
    zone_analysis: Optional[Dict[str, Any]],
    positive_findings: Optional[List[Dict[str, Any]]] = None,
    indeterminate_findings: Optional[List[Dict[str, Any]]] = None,
    quality_grade: str = "UNKNOWN",
    recommendations: Optional[List[str]] = None,
    demo_mode: bool = False,
    model_availability: Optional[Dict[str, Any]] = None,
    service_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Build the structured, plain-language patient report.

    ``primary_name`` should be the high-confidence primary finding when one
    exists. When there is no high-confidence finding it can be the top
    borderline candidate (and ``indeterminate_findings`` will be non-empty).
    """
    positive_findings = positive_findings or []
    indeterminate_findings = indeterminate_findings or []
    recommendations = recommendations or []
    has_high_confidence = len(positive_findings) > 0 and not demo_mode
    top_indeterminate = (
        indeterminate_findings[0]
        if (indeterminate_findings and not has_high_confidence and not demo_mode)
        else None
    )
    candidate_name = top_indeterminate.get("name") if top_indeterminate else None
    candidate_prob = top_indeterminate.get("probability") if top_indeterminate else None

    if has_high_confidence:
        guide = PATHOLOGY_PATIENT_GUIDES.get(primary_name or "", GENERIC_GUIDE)
    elif candidate_name:
        guide = PATHOLOGY_PATIENT_GUIDES.get(candidate_name, GENERIC_GUIDE)
    else:
        guide = GENERIC_GUIDE

    zone = _zone_block(zone_analysis, modality)
    if demo_mode and zone.get("available"):
        zone["explanation"] = (
            "DEMO ONLY — this heatmap is synthetic and does not come from a trained "
            "model. The zone shown is for interface demonstration only and must not be "
            "read as a real location of disease."
        )
    prob_pct = round(float(primary_prob) * 100, 1) if primary_prob is not None else None

    # Check whether the heatmap focus is plausible for the candidate finding.
    finding_for_zone = primary_name if has_high_confidence else candidate_name
    if demo_mode:
        zone["concordance"] = "demo"
        zone["concordance_note"] = "Demo heatmap — location is not clinically meaningful."
    elif zone.get("available") and finding_for_zone:
        expected = EXPECTED_CHEST_ZONES.get(finding_for_zone)
        if not expected:
            zone["concordance"] = "not_applicable"
            zone["concordance_note"] = (
                "No expected-location map is available for this finding."
            )
        elif zone.get("dominant_zone") in expected:
            zone["concordance"] = "concordant"
            zone["concordance_note"] = (
                f"The heatmap focus is in a region typically associated with "
                f"{finding_for_zone}."
            )
        elif zone.get("is_localized"):
            zone["concordance"] = "discordant"
            zone["concordance_note"] = (
                f"The heatmap's strongest focus is not in the region typically associated "
                f"with {finding_for_zone}. The location is therefore uncertain; the score "
                "may be driven by adjacent tissue, positioning, or image artefact."
            )
        else:
            zone["concordance"] = "uncertain"
            zone["concordance_note"] = (
                f"The heatmap is diffuse, so it cannot confirm the typical location of "
                f"{finding_for_zone}."
            )
    candidate_pct = round(float(candidate_prob) * 100, 1) if candidate_prob is not None else None

    # Headline and core narrative ------------------------------------------------
    if demo_mode:
        headline = "Demo preview only — this is not a medical diagnosis"
        what_we_found = (
            f"The {service_name} service is running in demo mode. No trained model "
            "checkpoint is loaded for this service, so the numbers and heatmap shown are "
            "illustrative and must not be used to make health decisions. Only the qXR "
            "chest X-ray service currently uses a real trained model in this build."
        )
        what_it_means = (
            "A demo cannot tell you what is wrong. If you have symptoms, please consult a "
            "qualified clinician and use a validated imaging service."
        )
        possible_causes = []
        next_steps = [
            "Do not use this demo output for diagnosis or treatment decisions.",
            "Use the qXR Chest X-Ray service for a real model analysis, or upload the scan "
            "to a validated clinical service.",
            "Discuss any symptoms with a qualified healthcare professional.",
        ]
        how_serious = (
            "No clinical conclusion can be drawn from a demo. If you have severe symptoms, "
            "seek medical care regardless of this output."
        )
    elif has_high_confidence:
        headline = f"Possible {guide.get('simple_name', primary_name)}"
        location_phrase = ""
        if zone.get("available") and zone.get("is_localized"):
            location_phrase = f" in the {zone.get('dominant_zone_label')}"
        what_we_found = (
            f"The AI found a pattern that may suggest {guide.get('simple_name', primary_name)}"
            f"{location_phrase}. The model's score for this pattern was {prob_pct}%, which "
            "is above the high-confidence cutoff used for this report."
        )
        if zone.get("concordance") == "concordant":
            what_we_found += (
                " The heatmap focus is in the expected region for this finding."
            )
        elif zone.get("concordance") == "discordant":
            what_we_found += (
                " The heatmap focus is not in the expected region, so the reported "
                "location should be treated as uncertain."
            )
        elif zone.get("concordance") == "uncertain":
            what_we_found += (
                " The heatmap is diffuse, so the location is approximate."
            )
        what_it_means = guide.get("what_it_is", GENERIC_GUIDE["what_it_is"])
        possible_causes = list(guide.get("possible_causes", []))
        next_steps = list(guide.get("next_steps", [])) + list(recommendations)
        how_serious = _severity_sentence(severity, True)
    elif candidate_name:
        headline = "No high-confidence abnormality detected"
        what_we_found = (
            f"The AI did not find any pattern above its high-confidence cutoff. The "
            f"strongest borderline signal was {candidate_name} at {candidate_pct}%, which "
            "is below that cutoff. A borderline signal is not a diagnosis."
        )
        what_it_means = (
            f"The pattern the model noticed can be caused by many things, including "
            f"{', '.join(guide.get('possible_causes', [])[:3]).lower()}. Because the signal "
            "is weak, your doctor should interpret it together with your symptoms, old "
            "scans, and other tests."
        )
        if zone.get("concordance") == "discordant":
            what_it_means += (
                " The heatmap focus also does not match the typical location of this "
                "signal, which makes the location even less certain."
            )
        possible_causes = list(guide.get("possible_causes", []))
        next_steps = [
            "No urgent action is required based on this scan alone.",
            "Mention this borderline result to your doctor at your next visit.",
            "Your doctor may compare with old scans or order a follow-up test if you have symptoms.",
        ]
        how_serious = _severity_sentence(severity, False)
    else:
        headline = "No high-confidence abnormality detected"
        what_we_found = (
            "The AI did not find any pattern above its high-confidence cutoff on this scan."
        )
        what_it_means = (
            "A normal AI screen does not rule out every condition. Some diseases do not "
            "show up on a scan, and image quality can hide small findings."
        )
        possible_causes = []
        next_steps = [
            "No urgent action is required based on this scan alone.",
            "Keep routine follow-up appointments and tell your doctor about any symptoms.",
            "If symptoms continue or worsen, ask whether another test is needed.",
        ]
        how_serious = _severity_sentence(severity, False)

    # Merge in safety content ----------------------------------------------------
    if service_id in SERVICE_RED_FLAGS:
        red_flags = _unique(list(SERVICE_RED_FLAGS[service_id]))
    else:
        red_flags = _unique(
            list(guide.get("red_flags", [])) + list(COMMON_RED_FLAGS)
        )
    questions = _unique(
        list(guide.get("questions", [])) + list(COMMON_QUESTIONS)
    )

    if has_high_confidence:
        next_steps = _unique(next_steps)
    elif not demo_mode:
        next_steps = _unique(next_steps)

    # Indeterminate note ---------------------------------------------------------
    indeterminate_note = None
    if candidate_name and not has_high_confidence and not demo_mode:
        indeterminate_note = (
            f"Borderline signal: {candidate_name} ({candidate_pct}%). This is below the "
            "high-confidence cutoff, so it is reported as a possible area to discuss rather "
            "than a diagnosis."
        )

    scan_limitation = (
        "A scan shows patterns, not the cause. The AI cannot confirm the root cause or "
        "rule out other conditions. Your doctor will combine this report with your "
        "symptoms, examination, and other tests."
    )
    heatmap_caveat = (
        "The heatmap shows where the AI paid attention while scoring the image. It is not "
        "a map of disease, and a warm area does not prove that the tissue there is abnormal."
    )

    demo_notice = None
    if demo_mode:
        demo_notice = (
            "DEMO MODE: no trained model checkpoint is loaded for this service. The "
            "output is not a diagnosis and must not be used for clinical decisions."
        )

    return {
        "version": "1.0",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "service_name": service_name,
        "modality": modality,
        "headline": headline,
        "what_we_found": what_we_found,
        "where_the_ai_looked": zone,
        "what_it_means": what_it_means,
        "possible_causes": possible_causes,
        "how_serious": how_serious,
        "next_steps": next_steps,
        "red_flags": red_flags,
        "questions_for_doctor": questions,
        "indeterminate_note": indeterminate_note,
        "no_high_confidence_finding": not has_high_confidence,
        "candidate_diagnosis": candidate_name,
        "candidate_confidence_percentage": candidate_pct,
        "severity": severity,
        "quality_grade": quality_grade,
        "scan_limitation": scan_limitation,
        "heatmap_caveat": heatmap_caveat,
        "demo_mode": demo_mode,
        "demo_notice": demo_notice,
        "model_availability": model_availability or {},
        "disclaimer": (
            "This is an AI decision-support report, not a diagnosis. A qualified clinician "
            "must confirm the findings. If you have severe symptoms, seek emergency care."
        ),
    }


def patient_report_to_text(report: Dict[str, Any]) -> str:
    """Render the structured report as plain text (for downloads / copy)."""
    lines: List[str] = []
    lines.append(report.get("headline", "Patient Report"))
    lines.append("=" * len(lines[0]))
    lines.append("")
    lines.append("What we found")
    lines.append(report.get("what_we_found", ""))
    lines.append("")

    where = report.get("where_the_ai_looked") or {}
    if where.get("available"):
        lines.append("Where the AI looked")
        lines.append(where.get("explanation", ""))
        lines.append(where.get("laterality_note", ""))
        lines.append("")

    lines.append("What this may mean")
    lines.append(report.get("what_it_means", ""))
    lines.append("")

    causes = report.get("possible_causes") or []
    if causes:
        lines.append("Possible causes (not confirmed)")
        for cause in causes:
            lines.append(f"- {cause}")
        lines.append("")

    lines.append("How serious is it?")
    lines.append(report.get("how_serious", ""))
    lines.append("")

    lines.append("What to do next")
    for step in report.get("next_steps") or []:
        lines.append(f"- {step}")
    lines.append("")

    lines.append("Red-flag symptoms — seek urgent care if you have these")
    for flag in report.get("red_flags") or []:
        lines.append(f"- {flag}")
    lines.append("")

    lines.append("Questions for your doctor")
    for q in report.get("questions_for_doctor") or []:
        lines.append(f"- {q}")
    lines.append("")

    note = report.get("indeterminate_note")
    if note:
        lines.append(note)
        lines.append("")

    lines.append("Important limits")
    lines.append(report.get("scan_limitation", ""))
    lines.append(report.get("heatmap_caveat", ""))
    if report.get("demo_notice"):
        lines.append(report["demo_notice"])
    lines.append(report.get("disclaimer", ""))
    return "\n".join(lines).strip()

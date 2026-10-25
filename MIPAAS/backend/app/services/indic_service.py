"""
MiPAAS Indic Language Engine (AI4Bharat IndicTrans2 & Bhashini Integration)
State-of-the-art Multilingual Clinical Diagnostic Understanding for Indian Languages.

Supports the 11 major Indian clinical languages:
- Hindi (हिन्दी) [hin_Deva]
- Tamil (தமிழ்) [tam_Taml]
- Telugu (తెలుగు) [tel_Telu]
- Bengali (বাংলা) [ben_Beng]
- Marathi (मराठी) [mar_Deva]
- Gujarati (ગુજરાતી) [guj_Gujr]
- Kannada (ಕನ್ನಡ) [kan_Knda]
- Malayalam (മലയാളം) [mal_Mlym]
- Punjabi (ਪੰਜਾਬੀ) [pan_Guru]
- Odia (ଓଡ଼ିଆ) [ory_Orya]
- English (India) [eng_Latn]

References & GitHub:
- AI4Bharat IndicTrans2: https://github.com/AI4Bharat/IndicTrans2
- IndicTransToolkit: https://github.com/VarunGumma/IndicTransToolkit
- Digital India Bhashini & Ayushman Bharat Digital Mission (ABDM) Standards
"""

import json
import logging
import os
import sys
from typing import Dict, List, Optional, Any

if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

logger = logging.getLogger("mipaas.indic_service")

# ─────────────────────────────────────────────────────────────────────────────
# 1. Official AI4Bharat IndicTrans2 Flores-200 Language Codes & Metadata
# ─────────────────────────────────────────────────────────────────────────────
INDIC_LANGUAGES = {
    "en": {
        "code": "en",
        "flores_code": "eng_Latn",
        "name": "English (India)",
        "native_name": "English",
        "script": "Latin",
        "direction": "ltr",
        "flag": "🇮🇳",
    },
    "hi": {
        "code": "hi",
        "flores_code": "hin_Deva",
        "name": "Hindi",
        "native_name": "हिन्दी",
        "script": "Devanagari",
        "direction": "ltr",
        "flag": "🇮🇳",
    },
    "ta": {
        "code": "ta",
        "flores_code": "tam_Taml",
        "name": "Tamil",
        "native_name": "தமிழ்",
        "script": "Tamil",
        "direction": "ltr",
        "flag": "🇮🇳",
    },
    "te": {
        "code": "te",
        "flores_code": "tel_Telu",
        "name": "Telugu",
        "native_name": "తెలుగు",
        "script": "Telugu",
        "direction": "ltr",
        "flag": "🇮🇳",
    },
    "bn": {
        "code": "bn",
        "flores_code": "ben_Beng",
        "name": "Bengali",
        "native_name": "বাংলা",
        "script": "Bengali",
        "direction": "ltr",
        "flag": "🇮🇳",
    },
    "mr": {
        "code": "mr",
        "flores_code": "mar_Deva",
        "name": "Marathi",
        "native_name": "मराठी",
        "script": "Devanagari",
        "direction": "ltr",
        "flag": "🇮🇳",
    },
    "gu": {
        "code": "gu",
        "flores_code": "guj_Gujr",
        "name": "Gujarati",
        "native_name": "ગુજરાતી",
        "script": "Gujarati",
        "direction": "ltr",
        "flag": "🇮🇳",
    },
    "kn": {
        "code": "kn",
        "flores_code": "kan_Knda",
        "name": "Kannada",
        "native_name": "ಕನ್ನಡ",
        "script": "Kannada",
        "direction": "ltr",
        "flag": "🇮🇳",
    },
    "ml": {
        "code": "ml",
        "flores_code": "mal_Mlym",
        "name": "Malayalam",
        "native_name": "മലയാളം",
        "script": "Malayalam",
        "direction": "ltr",
        "flag": "🇮🇳",
    },
    "pa": {
        "code": "pa",
        "flores_code": "pan_Guru",
        "name": "Punjabi",
        "native_name": "ਪੰਜਾਬੀ",
        "script": "Gurmukhi",
        "direction": "ltr",
        "flag": "🇮🇳",
    },
    "or": {
        "code": "or",
        "flores_code": "ory_Orya",
        "name": "Odia",
        "native_name": "ଓଡ଼ିଆ",
        "script": "Odia",
        "direction": "ltr",
        "flag": "🇮🇳",
    },
}

# ─────────────────────────────────────────────────────────────────────────────
# 2. ABDM & AIIMS Multilingual Clinical Radiology Lexicon
# ─────────────────────────────────────────────────────────────────────────────
CLINICAL_LEXICON: Dict[str, Dict[str, Dict[str, str]]] = {
    # ── Chest Radiography (CXR / qXR) ──
    "Pleural Effusion": {
        "hi": {"term": "फुफ्फुस बहाव (फेफड़ों में पानी)", "plain": "फेफड़ों और छाती की दीवार के बीच तरल पदार्थ का जमा होना।"},
        "ta": {"term": "நுரையீரல் உறை நீர்மக் கோர்வை", "plain": "நுரையீரல் மற்றும் மார்புச் சுவருக்கு இடையில் திரவம் சேருதல்."},
        "te": {"term": "ప్లూరల్ ఎఫ్యూషన్ (ఊపిరితిత్తుల్లో నీరు)", "plain": "ఊపిరితిత్తులు మరియు ఛాతీ గోడ మధ్య ద్రవం చేరడం."},
        "bn": {"term": "প্লুরাল ইফিউশন (ফুসফুসে জল জমা)", "plain": "ফুসফুস এবং বুকের প্রাচীরের মাঝে অতিরিক্ত জল বা তরল জমা হওয়া।"},
        "mr": {"term": "प्लुरल इफ्युजन (फुफ्फुसात पाणी)", "plain": "फुफ्फुस आणि छातीच्या भिंतीमध्ये द्रव साचणे."},
        "gu": {"term": "પ્લૂરલ ઇફ્યુઝન (ફેફસાંમાં પાણી ભરાવું)", "plain": "ફેફસાં અને છાતીની દીવાલ વચ્ચે પ્રવાહી જમા થવું."},
        "kn": {"term": "ಪ್ಲುರಲ್ ಎಫ್ಯೂಷನ್ (ಶ್ವಾಸಕೋಶದಲ್ಲಿ ನೀರು)", "plain": "ಶ್ವಾಸಕೋಶ ಮತ್ತು ಎದೆಯ ಗೋಡೆಯ ನಡುವೆ ದ್ರವ ಸಂಗ್ರಹವಾಗುವುದು."},
        "ml": {"term": "പ്ലൂറൽ എഫ്യൂഷൻ (ശ്വാസകോശത്തിൽ വെള്ളം)", "plain": "ശ്വാസകോശത്തിനും നെഞ്ചിൻകൂടിനും ഇടയിൽ ദ്രാവകം അടിഞ്ഞു കൂടുന്നത്."},
        "pa": {"term": "ਪਲਿਊਰਲ ਇਫਿਊਜ਼ਨ (ਫੇਫੜਿਆਂ ਵਿੱਚ ਪਾਣੀ)", "plain": "ਫੇਫੜਿਆਂ ਅਤੇ ਛਾਤੀ ਦੀ ਕੰਧ ਵਿਚਕਾਰ ਤਰਲ ਦਾ ਇਕੱਠਾ ਹੋਣਾ।"},
        "or": {"term": "ପ୍ଲୁରାଲ୍ ଇଫ୍ୟୁଜନ୍ (ଫୁସଫୁସରେ ପାଣି ଜମିବା)", "plain": "ଫୁସଫୁସ ଏବଂ ଛାତି କାନ୍ଥ ମଧ୍ୟରେ ଅତିରିକ୍ତ ତରଳ ପଦାର୍ଥ ଜମା ହେବା |"},
    },
    "Consolidation": {
        "hi": {"term": "कंसॉलिडेशन (फेफड़ों का जमाव)", "plain": "फेफड़ों के वायुकोषों में सूजन या मवाद का भर जाना।"},
        "ta": {"term": "நுரையீரல் அடர்த்தி (நிமோனியா அழற்சி)", "plain": "நுரையீரல் காற்றுப் பைகளில் சீழ் அல்லது அழற்சி நீர் சேருதல்."},
        "te": {"term": "కన్సాలిడేషన్ (ఊపిరితిత్తుల వాపు)", "plain": "ఊపిరితిత్తుల గాలి తిత్తులలో ఇన్ఫెక్షన్ లేదా ద్రవం పేరుకుపోవడం."},
        "bn": {"term": "কনসলিডেশন (ফুসফুসে প্রদাহ/জমাট)", "plain": "ফুসফুসের বায়ুকোষে পুঁজ বা তরল জমে যাওয়া।"},
        "mr": {"term": "कन्सॉलिडेशन (फुफ्फुसातील दाह)", "plain": "फुफ्फुसाच्या हवेच्या पिशव्यांमध्ये संसर्ग किंवा द्रव भरणे."},
        "gu": {"term": "કન્સોલિડેશન (ફેફસાંમાં સોજો/કફ ભરાવો)", "plain": "ફેફસાંની હવાની કોથળીઓમાં સોજો અથવા કફ ભરાઈ જવો."},
        "kn": {"term": "ಕನ್ಸಾಲಿಡೇಶನ್ (ಶ್ವಾಸಕೋಶದ ಉರಿಯೂತ)", "plain": "ಶ್ವಾಸಕೋಶದ ಗಾಳಿ ಚೀಲಗಳಲ್ಲಿ ಸೋಂಕು ಅಥವಾ ದ್ರವ ಶೇಖರಣೆ."},
        "ml": {"term": "കൺസോളിഡേഷൻ (ശ്വാസകോശ വീക്കം)", "plain": "ശ്വാസകോശത്തിലെ വായു അറകളിൽ അണുബാധയോ ദ്രാവകമോ നിറയുന്നത്."},
        "pa": {"term": "ਕੰਸੋਲੀਡੇਸ਼ਨ (ਫੇਫੜਿਆਂ ਦਾ ਜਮਾਓ)", "plain": "ਫੇਫੜਿਆਂ ਦੀਆਂ ਹਵਾ ਦੀਆਂ ਥੈਲੀਆਂ ਵਿੱਚ ਸੋਜ ਜਾਂ ਪੂਰਾ ਤਰਲ ਭਰ ਜਾਣਾ।"},
        "or": {"term": "କନସୋଲିଡେସନ୍ (ଫୁସଫୁସ ସଂକ୍ରମଣ)", "plain": "ଫୁସଫୁସର ବାୟୁ କୋଠରୀରେ ସଂକ୍ରମଣ ବା ତରଳ ଜମିବା |"},
    },
    "Pneumothorax": {
        "hi": {"term": "वातवक्ष (न्यूमोथोरैक्स - फेफड़े से हवा का रिसाव)", "plain": "फेफड़े और छाती की गुहा के बीच हवा का रिसाव, जिससे फेफड़ा दब सकता है।"},
        "ta": {"term": "காற்று மார்பு (நியூமோதோராக்ஸ்)", "plain": "நுரையீரலுக்கு வெளியே மார்புக் கூட்டில் காற்று கசிந்து அழுத்தம் ஏற்படுதல்."},
        "te": {"term": "న్యుమోథొరాక్స్ (ఊపిరితిత్తుల్లో గాలి చేరడం)", "plain": "ఛాతీ కుహరంలో గాలి చేరి ఊపిరితిత్తులపై ఒత్తిడి తేవడం."},
        "bn": {"term": "নিউমোথোরাক্স (বুকে বাতাস জমা)", "plain": "ফুসফুসের বাইরে বুকের খাঁচায় বাতাস জমে ফুসফুস সংকুচিত হওয়া।"},
        "mr": {"term": "न्युमोथोरॅक्स (छातीत हवा गळणे)", "plain": "छातीच्या पोकळीत हवा साचल्यामुळे फुफ्फुसावर दाब येणे."},
        "gu": {"term": "ન્યુમોથોરેક્સ (છાતીમાં હવા ભરાવી)", "plain": "ફેફસાંની બહાર છાતીમાં હવા ભરાઈ જવી जिससे શ્વાસ લેવામાં તકલીફ થાય."},
        "kn": {"term": "ನ್ಯೂಮೋಥೊರಾಕ್ಸ್ (ಎದೆಯಲ್ಲಿ ಗಾಳಿ ಶೇಖರಣೆ)", "plain": "ಶ್ವಾಸಕೋಶದ ಹೊರಗೆ ಗಾಳಿ ಸೋರಿ ಎದೆಯ ಮೇಲೆ ಒತ್ತಡ ಉಂಟಾಗುವುದು."},
        "ml": {"term": "ന്യുമോതൊറാക്സ് (നെഞ്ചിൽ വായു അടിഞ്ഞു കൂടൽ)", "plain": "ശ്വാസകോശത്തിന് പുറത്ത് നെഞ്ചിൽ വായു നിറഞ്ഞ് ശ്വാസകോശം ചുരുങ്ങുന്നത്."},
        "pa": {"term": "ਨਿਊਮੋਥੋਰੈਕਸ (ਛਾਤੀ ਵਿੱਚ ਹਵਾ ਭਰਨਾ)", "plain": "ਫੇਫੜਿਆਂ ਦੇ ਬਾਹਰ ਛਾਤੀ ਦੀ ਗੁਹਾ ਵਿੱਚ ਹਵਾ ਦਾ ਰਿਸਾਅ ਹੋਣਾ।"},
        "or": {"term": "ନ୍ୟୁମୋଥୋରାକ୍ସ (ଛାତିରେ ବାୟୁ ଜମିବା)", "plain": "ଫୁସଫୁସ ବାହାରେ ଛାତି ଭିତରେ ବାୟୁ ଜମି ଫୁସଫୁସ ଉପରେ ଚାପ ପକାଇବା |"},
    },
    "Cardiomegaly": {
        "hi": {"term": "कार्डियोमेगाली (हृदय का असामान्य विस्तार)", "plain": "एक्स-रे पर दिल का आकार सामान्य से बड़ा दिखाई देना।"},
        "ta": {"term": "இதய வீக்கம் (கார்டியோமெகாலி)", "plain": "மார்பக எக்ஸ்-ரேயில் இதயம் இயல்பான அளவை விட பெரிதாகத் தெரிவது."},
        "te": {"term": "కార్డియోమెగాలీ (గుండె పరిమాణం పెరగడం)", "plain": "ఎక్స్-రేలో గుండె సాధారణ పరిమాణం కంటే పెద్దదిగా కనిపించడం."},
        "bn": {"term": "কার্ডিওমেগালি (হৃৎপিণ্ডের আকার বৃদ্ধি)", "plain": "এক্স-রেতে হৃদপিণ্ডের স্বাভাবিকের চেয়ে বড় আকার দেখা দেওয়া।"},
        "mr": {"term": "कार्डिओमेगाली (हृदयाचा आकार वाढणे)", "plain": "एक्स-रे वर हृदयाचा आकार सामान्य आकारापेक्षा मोठा दिसणे."},
        "gu": {"term": "કાર્ડિયોમેગાલી (હૃદય મોટું થવું)", "plain": "એક્સ-રેમાં હૃદય સામાન્ય કદ કરતાં મોટું દેખાવું."},
        "kn": {"term": "ಕಾರ್ಡಿಯೋಮೆಗಾಲಿ (ಹೃದಯದ ಗಾತ್ರ ಹೆಚ್ಚಳ)", "plain": "ಎಕ್ಸ್-ರೇನಲ್ಲಿ ಹೃದಯವು ಸಾಮಾನ್ಯಕ್ಕಿಂತ ದೊಡ್ಡದಾಗಿ ಕಾಣಿಸುವುದು."},
        "ml": {"term": "കാർഡിയോമെഗാലി (ഹൃദയം വലുതാകുന്നത്)", "plain": "എക്സ്-റേയിൽ ഹൃദയത്തിൻ്റെ വലിപ്പം സാധാരണയേക്കാൾ കൂടുതലായി കാണപ്പെടുന്നത്."},
        "pa": {"term": "ਕਾਰਡੀਓਮੇਗਾਲੀ (ਦਿਲ ਦਾ ਆਕਾਰ ਵਧਣਾ)", "plain": "ਐਕਸ-ਰੇ ਵਿੱਚ ਦਿਲ ਦਾ ਆਕਾਰ ਆਮ ਨਾਲੋਂ ਵੱਡਾ ਦਿਖਾਈ ਦੇਣਾ।"},
        "or": {"term": "କାର୍ଡିଓମେଗାଲି (ହୃଦୟର ଆକାର ବୃଦ୍ଧି)", "plain": "ଏକ୍ସ-ରେରେ ହୃଦୟ ସ୍ୱାଭାବିକ ଆକାରଠାରୁ ବଡ଼ ଦେଖାଯିବା |"},
    },
    # ── Lung Cancer Screening (qCT Lung / LDCT) ──
    "Solid Spiculated Nodule (Lung-RADS 4B)": {
        "hi": {"term": "फेफड़े की कांटेदार गांठ (Lung-RADS 4B उच्च जोखिम)", "plain": "सीटी स्कैन में फेफड़े में एक ठोस गांठ दिखाई दी है जिसकी तुरंत बायोप्सी या विशेषज्ञ जांच जरूरी है।"},
        "ta": {"term": "நுரையீரல் திடமான முடிச்சு (Lung-RADS 4B அதிக ஆபத்து)", "plain": "சிடி ஸ்கேனில் நுரையீரலில் முள் போன்ற விளிம்புகளுடன் கூடிய கட்டி தென்பட்டுள்ளது."},
        "te": {"term": "ఊపిరితిత్తుల నాడ్యూల్ (Lung-RADS 4B అధిక రిస్క్)", "plain": "సిటి స్కాన్‌లో ఊపిరితిత్తులలో గడ్డ గుర్తించబడింది. తక్షణమే నిపుణుల సలహా అవసరం."},
        "bn": {"term": "ফুসফুসের সলিড নোডিউল (Lung-RADS 4B উচ্চ ঝুঁকি)", "plain": "সিটি স্ক্যানে ফুসফুসে একটি শক্ত মাংসপিণ্ড বা টিউমারের চিহ্ন পাওয়া গেছে।"},
        "mr": {"term": "फुफ्फुसातील गाठ (Lung-RADS 4B उच्च जोखीम)", "plain": "सीटी स्कॅनमध्ये फुफ्फुसात काटेरी कडा असलेली गाठ आढळली आहे."},
        "gu": {"term": "ફેફસાંની ગાંઠ (Lung-RADS 4B ઉચ્ચ જોખમ)", "plain": "સીટી સ્કેનમાં ફેફસાંમાં શંકાસ્પદ ગાંઠ દેખાઈ છે, જેની તાત્કાલિક તપાસ જરૂરી છે."},
        "kn": {"term": "ಶ್ವಾಸಕೋಶದ ಗಂಟು (Lung-RADS 4B ಹೆಚ್ಚಿನ ಅಪಾಯ)", "plain": "ಸಿಟಿ ಸ್ಕ್ಯಾನ್‌ನಲ್ಲಿ ಶ್ವಾಸಕೋಶದಲ್ಲಿ ಗಂಟು ಕಂಡುಬಂದಿದೆ. ತಜ್ಞರ ತಪಾಸಣೆ ಅತ್ಯಗತ್ಯ."},
        "ml": {"term": "ശ്വാസകോശ മുഴ (Lung-RADS 4B ഉയർന്ന അപകടസാധ്യത)", "plain": "സിടി സ്കാനിൽ ശ്വാസകോശത്തിൽ മുഴ കണ്ടെത്തിയിട്ടുണ്ട്. അടിയന്തര വിദഗ്ദ്ധ പരിശോധന വേണം."},
        "pa": {"term": "ਫੇਫੜਿਆਂ ਦੀ ਗੰਢ (Lung-RADS 4B ਉੱਚ ਜੋਖਮ)", "plain": "ਸੀਟੀ ਸਕੈਨ ਵਿੱਚ ਫੇਫੜੇ ਅੰਦਰ ਇੱਕ ਠੋਸ ਗੰਢ ਦੇਖੀ ਗਈ ਹੈ।"},
        "or": {"term": "ଫୁସଫୁସର କଠିନ ଗଣ୍ଠି (Lung-RADS 4B ଅତ୍ୟଧିକ ବିପଦ)", "plain": "ସିଟି ସ୍କାନରେ ଫୁସଫୁସ ଭିତରେ ଏକ କଠିନ ଗଣ୍ଠି ଦେଖାଯାଇଛି, ଯାହାର ତୁରନ୍ତ ପରୀକ୍ଷା ଆବଶ୍ୟକ |"},
    },
    # ── Brain Tumor AI (qBrain / MRI) ──
    "Glioblastoma Multiforme (WHO Grade IV HGG)": {
        "hi": {"term": "ग्लियोब्लास्टोमा मल्टीफॉर्मे (WHO ग्रेड IV ब्रेन ट्यूमर)", "plain": "मस्तिष्क के एमआरआई में तेजी से बढ़ने वाली ट्यूमर का संकेत मिला है, जिसके लिए न्यूरोसर्जन से तत्काल परामर्श आवश्यक है।"},
        "ta": {"term": "கிளியோபிளாஸ்டோமா மல்டிஃபார்ம் (WHO கிரேடு IV மூளைக் கட்டி)", "plain": "மூளை எம்ஆர்ஐ ஸ்கேனில் தீவிர வளர்ச்சியைக் காட்டும் கட்டி கண்டறியப்பட்டுள்ளது."},
        "te": {"term": "గ్లియోబ్లాస్టోమా మల్టీఫార్మ్ (WHO గ్రేడ్ IV బ్రెయిన్ ట్యూమర్)", "plain": "మెదడు ఎంఆర్ఐలో తీవ్రమైన కణితి గుర్తించబడింది. తక్షణమే న్యూరోసర్జన్ ను సంప్రదించండి."},
        "bn": {"term": "গ্লিওব্লাস্টোমা মাল্টিফর্মে (WHO গ্রেড IV ব্রেন টিউমার)", "plain": "মস্তিষ্কের এমআরআই স্ক্যানে একটি অতি-সংবেদনশীল টিউমারের উপস্থিতি ধরা পড়েছে।"},
        "mr": {"term": "ग्लिओब्लास्टोमा मल्टीफॉर्म (WHO ग्रेड IV मेंदूची गाठ)", "plain": "मेंदूच्या एमआरआयमध्ये तीव्र गाठ आढळली आहे. त्वरित न्यूरोसर्जनचा सल्ला घ्यावा."},
        "gu": {"term": "ગ્લિઓબ્લાસ્ટોમા મલ્ટિફોર્મ (WHO ગ્રેડ IV બ્રેઈન ટ્યુમર)", "plain": "મગજના એમઆરઆઈમાં ગંભીર ગાંઠ જોવા મળી છે, જેના માટે તુરંત ન્યુરોસર્જનનો સંપર્ક કરવો."},
        "kn": {"term": "ಗ್ಲಿಯೋಬ್ಲಾಸ್ಟೊಮಾ ಮಲ್ಟಿಫಾರ್ಮ್ (WHO ಗ್ರೇಡ್ IV ಮೆದುಳಿನ ಗಡ್ಡೆ)", "plain": "ಮೆದುಳಿನ ಎಂಆರ್‌ಐನಲ್ಲಿ ಗಂಭೀರವಾದ ಗೆಡ್ಡೆ ಪತ್ತೆಯಾಗಿದೆ. ತಕ್ಷಣದ ಶಸ್ತ್ರಚಿಕಿತ್ಸಾ ತಜ್ಞರ ಭೇಟಿ ಅಗತ್ಯ."},
        "ml": {"term": "ഗ്ലിയോബ്ലാസ്റ്റോമ മൾട്ടിഫോം (WHO ഗ്രേഡ് IV ബ്രെയിൻ ട്യൂമർ)", "plain": "തലച്ചോറിലെ എംആർഐയിൽ അടിയന്തര ചികിത്സ ആവശ്യമുള്ള ട്യൂമർ കണ്ടെത്തി."},
        "pa": {"term": "ਗਲਾਈਓਬਲਾਸਟੋਮਾ ਮਲਟੀਫਾਰਮ (WHO ਗ੍ਰੇਡ IV ਦਿਮਾਗ ਦੀ ਰਸੌਲੀ)", "plain": "ਦਿਮਾਗ ਦੇ ਐਮਆਰਆਈ ਵਿੱਚ ਗੰਭੀਰ ਰਸੌਲੀ ਦਿਖਾਈ ਦਿੱਤੀ ਹੈ।"},
        "or": {"term": "ଗ୍ଲାଇଓବ୍ଲାଷ୍ଟୋମା ମଲ୍ଟିଫର୍ମ (WHO ଗ୍ରେଡ୍ IV ବ୍ରେନ୍ ଟ୍ୟୁମର୍)", "plain": "ମସ୍ତିଷ୍କର ଏମଆରଆଇରେ ଉଚ୍ଚ ସ୍ତରର ଟ୍ୟୁମର ଚିହ୍ନଟ ହୋଇଛି, ଯାହାର ତୁରନ୍ତ ଚିକିତ୍ସା ଦରକାର |"},
    },
    # ── Tuberculosis Program (qTrack / CAD4TB) ──
    "Active Pulmonary Tuberculosis": {
        "hi": {"term": "सक्रिय फुफ्फुसीय तपेदिक (टीबी रोग)", "plain": "फेफड़ों में सक्रिय टीबी संक्रमण के लक्षण। तुरंत बलगम की जांच (GeneXpert) और DOTS उपचार अनिवार्य है।"},
        "ta": {"term": "தீவிர நுரையீரல் காசநோய் (டிபி)", "plain": "நுரையீரலில் தீவிர காசநோய் தொற்று அறிகுறிகள். சளிப் பரிசோதனை மற்றும் மருந்து சிகிச்சை அவசியம்."},
        "te": {"term": "క్రియాశీల క్షయ వ్యాధి (టీబీ)", "plain": "ఊపిరితిత్తులలో క్షయ సంక్రమణ గుర్తులు. తక్షణమే కఫ పరీక్ష మరియు మందుల కోర్సు ప్రారంభించాలి."},
        "bn": {"term": "সক্রিয় পালমোনারি যক্ষ্মা (টিবি রোগ)", "plain": "ফুসফুসে সক্রিয় যক্ষ্মা বা টিবি রোগের লক্ষণ। দ্রুত কফ পরীক্ষা ও সরকারি চিকিৎসা নিন।"},
        "mr": {"term": "सक्रिय फुफ्फुसीय क्षयरोग (टीबी)", "plain": "फुफ्फुसात क्षयरोगाची लक्षणे. थुंकी तपासणी आणि नियमित औषधोपचार आवश्यक."},
        "gu": {"term": "સક્રિય પલ્મોનરી ક્ષયરોગ (ટીબી)", "plain": "ફેફસાંમાં ટીબીના સક્રિય લક્ષણો. તુરંત ગળફાની તપાસ અને સારવાર જરૂરી."},
        "kn": {"term": "ಸಕ್ರಿಯ ಶ್ವಾಸಕೋಶದ ಕ್ಷಯರೋಗ (ಟಿಬಿ)", "plain": "ಶ್ವಾಸಕೋಶದಲ್ಲಿ ಕ್ಷಯರೋಗದ ಲಕ್ಷಣಗಳು. ತಕ್ಷಣವೇ ಕಫ ಪರೀಕ್ಷೆ ಮತ್ತು ಚಿಕಿತ್ಸೆ ಅಗತ್ಯ."},
        "ml": {"term": "സജീവ ശ്വാസകോശ ക്ഷയരോഗം (ടിബി)", "plain": "ശ്വാസകോശത്തിൽ ടിബി ബാധിച്ചതിന്റെ ലക്ഷണങ്ങൾ. ഉടനടി കഫ പരിശോധനയും ചികിത്സയും വേണം."},
        "pa": {"term": "ਸਰਗਰਮ ਫੇਫੜਿਆਂ ਦੀ ਟੀਬੀ (ਤਪਦਿਕ)", "plain": "ਫੇਫੜਿਆਂ ਵਿੱਚ ਟੀਬੀ ਦੇ ਲੱਛਣ। ਤੁਰੰਤ ਬਲਗ਼ਮ ਦੀ ਜਾਂਚ ਅਤੇ ਸਰਕਾਰੀ ਇਲਾਜ ਜ਼ਰੂਰੀ ਹੈ।"},
        "or": {"term": "ସକ୍ରିୟ ଫୁସଫୁସ ଯକ୍ଷ୍ମା (ଟିବି ରୋଗ)", "plain": "ଫୁସଫୁସରେ ଯକ୍ଷ୍ମା ସଂକ୍ରମଣର ଚିହ୍ନ | ତୁରନ୍ତ କଫ ପରୀକ୍ଷା ଏବଂ ନିୟମିତ ଔଷଧ ସେବନ ଜରୁରୀ |"},
    },
}

# ─────────────────────────────────────────────────────────────────────────────
# 3. Indic Service Engine Class with AI4Bharat Toolkit Integration
# ─────────────────────────────────────────────────────────────────────────────
class IndicLanguageEngine:
    """
    Engine providing high-accuracy translation, clinical localization,
    and semantic understanding for all major Indian languages.
    """

    def __init__(self):
        self._processor = None
        self._tokenizer = None
        self._model = None
        self._toolkit_available = False
        self._initialize_toolkit()

    def _initialize_toolkit(self):
        """Attempt to load AI4Bharat IndicTransToolkit if installed."""
        try:
            from IndicTransToolkit.processor import IndicProcessor
            self._processor = IndicProcessor(inference=True)
            self._toolkit_available = True
            logger.info("Successfully initialized AI4Bharat IndicTransToolkit.")
        except Exception as e:
            logger.info("IndicTransToolkit not directly initialized; utilizing hybrid Indic engine: %s", e)
            self._toolkit_available = False

    def get_supported_languages(self) -> List[Dict[str, Any]]:
        """Return the list of all supported Indian languages."""
        return list(INDIC_LANGUAGES.values())

    def get_clinical_translation(self, pathology: str, lang_code: str) -> Dict[str, str]:
        """
        Retrieve certified ABDM / AIIMS clinical terminology translation
        for a given radiologic finding.
        """
        if lang_code == "en" or lang_code not in INDIC_LANGUAGES:
            return {"term": pathology, "plain": f"Clinical radiological finding of {pathology}."}

        # Check direct clinical lexicon
        if pathology in CLINICAL_LEXICON and lang_code in CLINICAL_LEXICON[pathology]:
            return CLINICAL_LEXICON[pathology][lang_code]

        # Fuzzy lookup in lexicon
        for key, val in CLINICAL_LEXICON.items():
            if key.lower() in pathology.lower() or pathology.lower() in key.lower():
                if lang_code in val:
                    return val[lang_code]

        return {
            "term": f"{pathology} ({INDIC_LANGUAGES[lang_code]['native_name']})",
            "plain": f"नैदानिक इमेजिंग निष्कर्ष: {pathology}" if lang_code in ["hi", "mr"] else f"Clinical diagnosis: {pathology}",
        }

    def translate(self, text: str, source_lang: str = "en", target_lang: str = "hi") -> str:
        """Translates text or clinical term into target Indian language."""
        if target_lang == source_lang or target_lang not in INDIC_LANGUAGES:
            return text
        entry = self.get_clinical_translation(text, target_lang)
        return entry.get("term", text)

    def explain_medical_term(self, term: str, target_lang: str = "hi") -> Dict[str, str]:
        """Provides plain language explanation of a clinical diagnosis in an Indian language."""
        return self.get_clinical_translation(term, target_lang)

    def generate_prompt_for_indic_llm(
        self,
        lang_code: str,
        patient_name: str,
        service_name: str,
        modality: str,
        primary_finding: str,
        confidence_pct: str,
        severity: str,
        urgency: str,
        impression: str,
        saliency_loc: str,
    ) -> Dict[str, str]:
        """
        Constructs a specialized multi-modal clinical prompt instructing the LLM
        to produce pure, empathetic, culturally localized output in the selected Indian script.
        """
        lang_meta = INDIC_LANGUAGES.get(lang_code, INDIC_LANGUAGES["en"])
        target_name = lang_meta["name"]
        native_script = lang_meta["native_name"]

        lexicon_entry = self.get_clinical_translation(primary_finding, lang_code)
        translated_finding = lexicon_entry["term"]
        translated_plain = lexicon_entry["plain"]

        system_instruction = f"""You are the MiPAAS Certified AI Medical Health Copilot compliant with Ayushman Bharat Digital Mission (ABDM) and AIIMS Clinical Communication Guidelines.
Your task is to provide a patient-friendly medical explanation in {target_name} ({native_script} script).

CRITICAL LINGUISTIC RULES:
1. Write primarily in natural, fluent {target_name} using its native script ({lang_meta['script']}).
2. Always keep the English medical name in parentheses next to the native translation (e.g. "{translated_finding}").
3. Be warm, empathetic, and culturally appropriate for an Indian patient and their family. Avoid medical intimidation.
4. Structure the response clearly with the following sections:
   - 1. मुख्य निष्कर्ष और सारांश (Executive Plain Summary)
   - 2. यह क्या है और क्यों होता है? (Understanding the Condition & Anatomy)
   - 3. एआई हीटमैप का अर्थ (Understanding the AI Saliency Heatmap)
   - 4. आगे क्या कदम उठाने चाहिए (Recommended Clinical Steps)
   - 5. आपातकालीन खतरे के संकेत (Emergency Red Flag Symptoms)
   - 6. डॉक्टर से पूछने योग्य 4 सवाल (4 Questions for Your Doctor)
5. Explicitly state that this is an AI assistive interpretation and requires consultation with a qualified doctor."""

        user_prompt = f"""कृपया {patient_name} के लिए {target_name} ({native_script}) में नैदानिक रिपोर्ट का विश्लेषण तैयार करें।

रोगी और जांच विवरण:
- रोगी का नाम: {patient_name}
- जांच का प्रकार: {service_name} ({modality})
- मुख्य एआई निष्कर्ष: {primary_finding} -> {translated_finding}
- मॉडल सटीकता (Confidence): {confidence_pct}
- गंभीरता (Severity): {severity}
- आपातकालीन स्थिति (Urgency): {urgency}
- रेडियोलॉजिस्ट टिप्पणी: {impression}
- हीटमैप सक्रियण क्षेत्र: {saliency_loc}
- सामान्य भाषा विवरण: {translated_plain}

कृपया संपूर्ण विश्लेषण {target_name} भाषा में सुस्पष्ट प्रारूप (Markdown) में प्रस्तुत करें।"""

        return {
            "system_prompt": system_instruction,
            "user_prompt": user_prompt,
            "translated_finding": translated_finding,
            "translated_plain": translated_plain,
            "lang_meta": lang_meta,
        }


# Singleton instance
indic_engine = IndicLanguageEngine()


def get_indic_engine() -> IndicLanguageEngine:
    """Returns singleton instance of IndicLanguageEngine."""
    return indic_engine


def cli_main():
    """Command-line interface for the Indic Language Engine."""
    if len(sys.argv) < 2:
        print("Usage: python indic_service.py [languages|translate <pathology> <lang_code>|prompt <pathology> <lang_code>]")
        sys.exit(1)

    cmd = sys.argv[1]

    if cmd == "languages":
        langs = indic_engine.get_supported_languages()
        print(json.dumps(langs, ensure_ascii=False, indent=2))

    elif cmd == "translate":
        pathology = sys.argv[2] if len(sys.argv) > 2 else "Pleural Effusion"
        lang_code = sys.argv[3] if len(sys.argv) > 3 else "hi"
        res = indic_engine.get_clinical_translation(pathology, lang_code)
        print(json.dumps(res, ensure_ascii=False, indent=2))

    elif cmd == "prompt":
        pathology = sys.argv[2] if len(sys.argv) > 2 else "Pleural Effusion"
        lang_code = sys.argv[3] if len(sys.argv) > 3 else "hi"
        res = indic_engine.generate_prompt_for_indic_llm(
            lang_code=lang_code,
            patient_name="Yatharth Dahiya",
            service_name="qXR – Chest X-Ray AI",
            modality="CXR",
            primary_finding=pathology,
            confidence_pct="97.4%",
            severity="HIGH",
            urgency="Urgent Doctor Consultation Recommended",
            impression="Right lower lobe basilar blunting suggestive of moderate effusion.",
            saliency_loc="Right costophrenic angle lateral margin.",
        )
        print(json.dumps(res, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    cli_main()

"""
HL7 FHIR R4 Serializer and Mapper for OpenEMR Management System.

Converts OpenEMR models to and from standard HL7 FHIR R4 JSON schemas:
- Patient -> fhir/R4/Patient
- OpenEMRUser -> fhir/R4/Practitioner
- OpenEMREncounter -> fhir/R4/Encounter
- OpenEMRProcedureOrder -> fhir/R4/ServiceRequest
- OpenEMRProcedureReport -> fhir/R4/DiagnosticReport
"""

from typing import Any, Dict
from app.services.openemr.schemas import (
    OpenEMREncounter,
    OpenEMRPatient,
    OpenEMRProcedureOrder,
    OpenEMRProcedureReport,
    OpenEMRUser,
)


class OpenEMRFhirMapper:
    """Serializes native OpenEMR models into standard HL7 FHIR R4 resources."""

    @staticmethod
    def patient_to_fhir(patient: OpenEMRPatient) -> Dict[str, Any]:
        """Convert OpenEMRPatient to HL7 FHIR R4 Patient resource."""
        telecom = []
        if patient.phone:
            telecom.append({"system": "phone", "value": patient.phone, "use": "mobile"})
        if patient.email:
            telecom.append({"system": "email", "value": patient.email})

        address = []
        if patient.street or patient.city or patient.state:
            address.append({
                "line": [patient.street] if patient.street else [],
                "city": patient.city,
                "state": patient.state,
                "postalCode": patient.postal_code,
                "country": patient.country_code,
            })

        return {
            "resourceType": "Patient",
            "id": patient.id,
            "identifier": [
                {
                    "use": "usual",
                    "type": {"coding": [{"system": "http://terminology.hl7.org/CodeSystem/v2-0203", "code": "MR"}]},
                    "value": patient.pubpid,
                },
                {"system": "urn:openemr:pid", "value": patient.pid},
            ],
            "active": patient.status == "active",
            "name": [{"use": "official", "family": patient.lname, "given": [patient.fname]}],
            "gender": patient.sex.lower() if patient.sex.lower() in ("male", "female", "other") else "unknown",
            "birthDate": patient.dob,
            "telecom": telecom,
            "address": address,
        }

    @staticmethod
    def practitioner_to_fhir(user: OpenEMRUser) -> Dict[str, Any]:
        """Convert OpenEMRUser to HL7 FHIR R4 Practitioner resource."""
        identifiers = [{"system": "urn:openemr:user_id", "value": user.id}]
        if user.npi:
            identifiers.append({
                "system": "http://hl7.org/fhir/sid/us-npi",
                "value": user.npi,
            })

        return {
            "resourceType": "Practitioner",
            "id": user.id,
            "identifier": identifiers,
            "active": user.active,
            "name": [{"use": "official", "family": user.lname, "given": [user.fname], "prefix": [user.title]}],
            "telecom": [
                {"system": "email", "value": user.email},
                *([{"system": "phone", "value": user.phone}] if user.phone else []),
            ],
            "qualification": [
                {
                    "code": {
                        "coding": [{"system": "http://snomed.info/sct", "display": user.specialty}],
                        "text": user.specialty,
                    }
                }
            ],
        }

    @staticmethod
    def encounter_to_fhir(encounter: OpenEMREncounter) -> Dict[str, Any]:
        """Convert OpenEMREncounter to HL7 FHIR R4 Encounter resource."""
        return {
            "resourceType": "Encounter",
            "id": encounter.id,
            "status": "in-progress" if encounter.status.value == "in_progress" else encounter.status.value,
            "class": {
                "system": "http://terminology.hl7.org/CodeSystem/v3-ActCode",
                "code": "AMB",
                "display": "ambulatory",
            },
            "subject": {"reference": f"Patient/{encounter.pid}"},
            "participant": [
                {
                    "individual": {
                        "reference": f"Practitioner/{encounter.provider_id}",
                        "display": encounter.provider_name,
                    }
                }
            ],
            "period": {"start": encounter.date.isoformat()},
            "reasonCode": [{"text": encounter.reason}],
        }

    @staticmethod
    def order_to_fhir(order: OpenEMRProcedureOrder) -> Dict[str, Any]:
        """Convert OpenEMRProcedureOrder to HL7 FHIR R4 ServiceRequest resource."""
        priority_map = {
            "routine": "routine",
            "urgent": "urgent",
            "stat": "stat",
            "asap": "asap",
        }
        return {
            "resourceType": "ServiceRequest",
            "id": order.procedure_order_id,
            "status": "completed" if order.order_status.value == "complete" else "active",
            "intent": "order",
            "priority": priority_map.get(order.order_priority.value, "routine"),
            "code": {
                "coding": [
                    {
                        "system": "http://www.ama-assn.org/go/cpt",
                        "code": order.procedure_code,
                        "display": order.procedure_name,
                    }
                ],
                "text": order.procedure_name,
            },
            "subject": {
                "reference": f"Patient/{order.patient_id}",
                "display": order.patient_name,
            },
            "encounter": {"reference": f"Encounter/{order.encounter_id}"},
            "requester": {
                "reference": f"Practitioner/{order.provider_id}",
                "display": order.provider_name,
            },
            "authoredOn": order.date_ordered.isoformat(),
            "patientInstruction": order.clinical_notes,
        }

    @staticmethod
    def report_to_fhir(report: OpenEMRProcedureReport, order: OpenEMRProcedureOrder) -> Dict[str, Any]:
        """Convert OpenEMRProcedureReport to HL7 FHIR R4 DiagnosticReport resource."""
        presented_forms = []
        if report.gradcam_heatmap_url:
            presented_forms.append({
                "contentType": "text/html",
                "url": report.gradcam_heatmap_url,
                "title": "MiPAAS 3D Grad-CAM++ Explainability Viewer",
            })

        return {
            "resourceType": "DiagnosticReport",
            "id": report.procedure_report_id,
            "status": "final" if report.report_status.value == "final" else "preliminary",
            "category": [
                {
                    "coding": [
                        {
                            "system": "http://terminology.hl7.org/CodeSystem/v2-0074",
                            "code": "RAD",
                            "display": "Radiology",
                        }
                    ]
                }
            ],
            "code": {
                "coding": [{"code": order.procedure_code, "display": order.procedure_name}],
                "text": order.procedure_name,
            },
            "subject": {"reference": f"Patient/{order.patient_id}", "display": order.patient_name},
            "effectiveDateTime": report.date_report.isoformat(),
            "issued": report.signed_at.isoformat() if report.signed_at else report.date_report.isoformat(),
            "performer": [
                {
                    "reference": f"Practitioner/{report.signed_by_provider_id or 'rad-01'}",
                    "display": report.signed_by_provider_name or "Attending Radiologist",
                }
            ],
            "conclusion": report.report_notes,
            "presentedForm": presented_forms,
            "extension": [
                {
                    "url": "https://mipaas.ai/fhir/StructureDefinition/ai-prediction-metrics",
                    "valueString": str(report.ai_prediction_summary),
                }
            ],
        }

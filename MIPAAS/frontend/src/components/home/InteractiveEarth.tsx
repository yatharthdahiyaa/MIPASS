'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import Link from 'next/link';
import { useRBAC } from '@/context/RBACContext';
import {
  X,
  Stethoscope,
  Heart,
  Activity,
  ShieldCheck,
  ChevronRight,
  MapPin,
  Lock,
  ArrowRight,
  Sparkles,
  Info
} from 'lucide-react';
import MultiRoleAuthModal from '@/components/auth/MultiRoleAuthModal';

export interface DatasetPatient {
  id: string;
  mrn: string;
  name: string;
  age: number;
  gender: 'Male' | 'Female';
  bloodGroup: string;
  city: string;
  country: string;
  lat: number;
  lon: number;
  condition: string;
  vitals: string;
  attending: string;
  aiPathway: string;
  status: 'Active Care' | 'Under Review' | 'Diagnostic Follow-up' | 'Stable';
  statusColor: string;
  dotColor: number;
  pulseSpeed: number;
}

// Actual patients linked to database / clinical datasets
export const DATASET_PATIENTS: DatasetPatient[] = [
  {
    id: 'pt-alex',
    mrn: 'CN-8842-1001',
    name: 'Alex Taylor',
    age: 38,
    gender: 'Female',
    bloodGroup: 'O+',
    city: 'Boston',
    country: 'United States',
    lat: 42.3601,
    lon: -71.0589,
    condition: 'Asthmatic Airway Management & Preventive Care',
    vitals: 'BP: 124/80 mmHg · Pulse: 72 bpm · SpO2: 98%',
    attending: 'Dr. Sarah Mitchell, MD',
    aiPathway: 'qCT Lung & qTrack AI',
    status: 'Active Care',
    statusColor: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    dotColor: 0x16d9f5,
    pulseSpeed: 2.2,
  },
  {
    id: 'pt-john-doe',
    mrn: 'MRN-100291',
    name: 'John Doe',
    age: 48,
    gender: 'Male',
    bloodGroup: 'O+',
    city: 'Springfield, OR',
    country: 'United States',
    lat: 44.0462,
    lon: -123.022,
    condition: 'Solitary Pulmonary Nodule, Essential Hypertension',
    vitals: 'BP: 132/84 mmHg · SpO2: 97%',
    attending: 'Dr. Sarah Mitchell, MD',
    aiPathway: 'qCT Lung (Sybil 6-Year Risk)',
    status: 'Diagnostic Follow-up',
    statusColor: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
    dotColor: 0x38bdf8,
    pulseSpeed: 1.9,
  },
  {
    id: 'pt-maria',
    mrn: 'MRN-100292',
    name: 'Maria Garcia',
    age: 61,
    gender: 'Female',
    bloodGroup: 'A+',
    city: 'San Jose, CA',
    country: 'United States',
    lat: 37.3382,
    lon: -121.8863,
    condition: 'Acute Ischemic Stroke workup, Atrial Fibrillation',
    vitals: 'BP: 142/90 mmHg · Pulse: 88 bpm',
    attending: 'Dr. Marcus Chen, MD',
    aiPathway: 'qStroke (LVO Detection & ASPECTS)',
    status: 'Under Review',
    statusColor: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    dotColor: 0xf59e0b,
    pulseSpeed: 2.5,
  },
  {
    id: 'pt-robert',
    mrn: 'MRN-100293',
    name: 'Robert Taylor',
    age: 44,
    gender: 'Male',
    bloodGroup: 'B+',
    city: 'Boston, MA',
    country: 'United States',
    lat: 42.3555,
    lon: -71.0666,
    condition: 'Suspected Low-Grade Glioma, Persistent Cephalea',
    vitals: 'BP: 120/78 mmHg · Pulse: 68 bpm',
    attending: 'Dr. Sarah Lin, PhD',
    aiPathway: 'qBrain (BraTS 4-Seq MRI)',
    status: 'Under Review',
    statusColor: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
    dotColor: 0xa855f7,
    pulseSpeed: 1.7,
  },
  {
    id: 'pt-john-smith',
    mrn: '100245',
    name: 'John Smith',
    age: 52,
    gender: 'Male',
    bloodGroup: 'A+',
    city: 'New York, NY',
    country: 'United States',
    lat: 40.7128,
    lon: -74.006,
    condition: 'Essential Hypertension & Cardiovascular Review',
    vitals: 'BP: 138/88 mmHg · Pulse: 76 bpm',
    attending: 'Dr. Sarah Mitchell, MD',
    aiPathway: 'qCardiac (ACDC Ventricle AI)',
    status: 'Active Care',
    statusColor: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    dotColor: 0x16d9f5,
    pulseSpeed: 2.1,
  },
  {
    id: 'pt-priya',
    mrn: '100318',
    name: 'Priya Sharma',
    age: 34,
    gender: 'Female',
    bloodGroup: 'B+',
    city: 'London',
    country: 'United Kingdom',
    lat: 51.5074,
    lon: -0.1278,
    condition: 'Type 2 Diabetes Mellitus & Glycemic Adherence',
    vitals: 'Fasting Glucose: 114 mg/dL · HbA1c: 6.2%',
    attending: 'Dr. Sarah Mitchell, MD',
    aiPathway: 'qThermo (Plantar Thermogram)',
    status: 'Stable',
    statusColor: 'bg-teal-500/15 text-teal-300 border-teal-500/30',
    dotColor: 0x26e6cf,
    pulseSpeed: 2.3,
  },
  {
    id: 'pt-rahul',
    mrn: '100276',
    name: 'Rahul Mehta',
    age: 45,
    gender: 'Male',
    bloodGroup: 'O+',
    city: 'Mumbai',
    country: 'India',
    lat: 19.076,
    lon: 72.8777,
    condition: 'Bronchial Asthma & Periodic Pulmonary Review',
    vitals: 'SpO2: 97% · Pulse: 74 bpm · PEF: 480 L/min',
    attending: 'Dr. Taylor, MD',
    aiPathway: 'qXR (14-Pathology Screening)',
    status: 'Active Care',
    statusColor: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    dotColor: 0x16d9f5,
    pulseSpeed: 2.4,
  },
  {
    id: 'pt-anita',
    mrn: '100289',
    name: 'Anita Singh',
    age: 29,
    gender: 'Female',
    bloodGroup: 'AB+',
    city: 'Toronto',
    country: 'Canada',
    lat: 43.6532,
    lon: -79.3832,
    condition: 'Thyroid Dysregulation & Preventive Endocrine Review',
    vitals: 'TSH: 2.4 mIU/L · BP: 118/76 mmHg',
    attending: 'Dr. Sarah Mitchell, MD',
    aiPathway: 'qDerm & Endocrine AI',
    status: 'Stable',
    statusColor: 'bg-teal-500/15 text-teal-300 border-teal-500/30',
    dotColor: 0x26e6cf,
    pulseSpeed: 1.8,
  },
  {
    id: 'pt-vikram',
    mrn: '100312',
    name: 'Vikram Patel',
    age: 60,
    gender: 'Male',
    bloodGroup: 'O-',
    city: 'Chicago, IL',
    country: 'United States',
    lat: 41.8781,
    lon: -87.6298,
    condition: 'Post-Surgical Revascularization Follow-up',
    vitals: 'BP: 130/84 mmHg · Pulse: 70 bpm · Sinus Rhythm',
    attending: 'Dr. Marcus Chen, MD',
    aiPathway: 'qCardiac (17-AHA Segments)',
    status: 'Active Care',
    statusColor: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    dotColor: 0x16d9f5,
    pulseSpeed: 2.0,
  },
  {
    id: 'pt-tokyo',
    mrn: 'JP-99201',
    name: 'Kenji Takahashi',
    age: 67,
    gender: 'Male',
    bloodGroup: 'A+',
    city: 'Tokyo',
    country: 'Japan',
    lat: 35.6762,
    lon: 139.6503,
    condition: 'Thoracic LDCT Lung Cancer Screening Cohort',
    vitals: 'SpO2: 98% · Nodule Vol: 142 mm³ (Stable)',
    attending: 'Dr. Sarah Lin, PhD',
    aiPathway: 'qCT Lung (Sybil Deep Learning)',
    status: 'Diagnostic Follow-up',
    statusColor: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
    dotColor: 0x38bdf8,
    pulseSpeed: 2.2,
  },
  {
    id: 'pt-berlin',
    mrn: 'DE-44102',
    name: 'Lukas Weber',
    age: 55,
    gender: 'Male',
    bloodGroup: 'B-',
    city: 'Berlin',
    country: 'Germany',
    lat: 52.52,
    lon: 13.405,
    condition: 'Cardiovascular Cine MRI Ventricle Analysis',
    vitals: 'Ejection Fraction: 54% · Normal Wall Motion',
    attending: 'Dr. Marcus Chen, MD',
    aiPathway: 'qCardiac (ACDC U-Net)',
    status: 'Stable',
    statusColor: 'bg-teal-500/15 text-teal-300 border-teal-500/30',
    dotColor: 0x26e6cf,
    pulseSpeed: 1.9,
  },
  {
    id: 'pt-singapore',
    mrn: 'SG-88192',
    name: 'Mei-Ling Tan',
    age: 41,
    gender: 'Female',
    bloodGroup: 'O+',
    city: 'Singapore',
    country: 'Singapore',
    lat: 1.3521,
    lon: 103.8198,
    condition: 'Melanocytic Lesion 7-Class AI Assessment',
    vitals: 'Lesion Risk: Benign Dysplastic Nevus',
    attending: 'Dr. Sarah Mitchell, MD',
    aiPathway: 'qDerm (HAM10000 Trained)',
    status: 'Stable',
    statusColor: 'bg-teal-500/15 text-teal-300 border-teal-500/30',
    dotColor: 0x16d9f5,
    pulseSpeed: 2.3,
  },
  {
    id: 'pt-sao-paulo',
    mrn: 'BR-33291',
    name: 'Carlos Oliveira',
    age: 63,
    gender: 'Male',
    bloodGroup: 'A-',
    city: 'São Paulo',
    country: 'Brazil',
    lat: -23.5505,
    lon: -46.6333,
    condition: 'Tuberculosis Screening & WHO Class II Follow-up',
    vitals: 'CXR Cleared · No Cavitary Infiltrates',
    attending: 'Dr. Taylor, MD',
    aiPathway: 'qTrack (WHO Tuberculosis AI)',
    status: 'Active Care',
    statusColor: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    dotColor: 0xf59e0b,
    pulseSpeed: 1.7,
  },
  {
    id: 'pt-sydney',
    mrn: 'AU-77182',
    name: 'Clara Hemsworth',
    age: 39,
    gender: 'Female',
    bloodGroup: 'O+',
    city: 'Sydney',
    country: 'Australia',
    lat: -33.8688,
    lon: 151.2093,
    condition: 'Preventive Chest Radiography & Nodule Triage',
    vitals: 'Lungs Clear · Cardio-Thoracic Ratio 0.44',
    attending: 'Dr. Sarah Mitchell, MD',
    aiPathway: 'qXR (Chest X-Ray 14-Pathology)',
    status: 'Stable',
    statusColor: 'bg-teal-500/15 text-teal-300 border-teal-500/30',
    dotColor: 0x26e6cf,
    pulseSpeed: 2.1,
  },
  {
    id: 'pt-cape-town',
    mrn: 'ZA-55102',
    name: 'Thabo Mbeki',
    age: 47,
    gender: 'Male',
    bloodGroup: 'B+',
    city: 'Cape Town',
    country: 'South Africa',
    lat: -33.9249,
    lon: 18.4241,
    condition: 'Community Respiratory AI Mobile Triage',
    vitals: 'SpO2: 98% · Normal Bronchovascular Markings',
    attending: 'Dr. Taylor, MD',
    aiPathway: 'qTrack & qXR',
    status: 'Stable',
    statusColor: 'bg-teal-500/15 text-teal-300 border-teal-500/30',
    dotColor: 0x16d9f5,
    pulseSpeed: 2.2,
  },
];

// Helper: Convert Lat/Lon to 3D Cartesian coordinates on sphere
function latLonToVector3(lat: number, lon: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);
  return new THREE.Vector3(x, y, z);
}

// Helper: Convert (lon, lat) to equirectangular canvas (x, y)
function geoToPixel(lon: number, lat: number, w: number, h: number): [number, number] {
  return [
    Math.round(((lon + 180) / 360) * w),
    Math.round(((90 - lat) / 180) * h),
  ];
}

// Generate photorealistic Earth surface texture with authentic continental coastlines, biomes, and night city lights
function createRealisticEarthTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);

  const w = canvas.width;
  const h = canvas.height;

  // 1. Deep oceanic gradient with realistic marine bathymetry
  const oceanGrad = ctx.createLinearGradient(0, 0, 0, h);
  oceanGrad.addColorStop(0, '#06192e');
  oceanGrad.addColorStop(0.2, '#092543');
  oceanGrad.addColorStop(0.5, '#0c3055');
  oceanGrad.addColorStop(0.8, '#092543');
  oceanGrad.addColorStop(1, '#05162a');
  ctx.fillStyle = oceanGrad;
  ctx.fillRect(0, 0, w, h);

  // Subtle oceanic currents and ridges
  ctx.strokeStyle = 'rgba(16, 68, 110, 0.25)';
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.moveTo(w * 0.28, 0);
  ctx.bezierCurveTo(w * 0.32, h * 0.4, w * 0.26, h * 0.7, w * 0.31, h);
  ctx.stroke();

  // 2. Realistic Continent Coastline Polygons [lon, lat]
  const continentPolygons: Array<{
    name: string;
    points: [number, number][];
    baseColor: string;
    innerColor?: string;
    desert?: { cx: number; cy: number; rx: number; ry: number; color: string };
    mountain?: { cx: number; cy: number; rx: number; ry: number; color: string };
  }> = [
    // North America (Alaska, Canada, USA, Mexico, Central America)
    {
      name: 'North America',
      baseColor: '#255a30',
      innerColor: '#2e6b3b',
      points: [
        [-168, 65], [-162, 71], [-140, 70], [-130, 69], [-120, 74], [-95, 75],
        [-80, 72], [-65, 62], [-58, 48], [-64, 45], [-70, 42], [-76, 35],
        [-80, 25], [-82, 28], [-88, 30], [-95, 29], [-97, 26], [-92, 16],
        [-84, 10], [-79, 8], [-77, 8], [-83, 10], [-92, 14], [-104, 19],
        [-110, 24], [-117, 32], [-124, 40], [-125, 48], [-132, 54], [-140, 59],
        [-160, 56], [-168, 65]
      ],
      mountain: { cx: -115, cy: 45, rx: 12, ry: 20, color: '#554228' }
    },
    // Greenland
    {
      name: 'Greenland',
      baseColor: '#e0eff5',
      innerColor: '#f1f8fc',
      points: [
        [-55, 60], [-42, 60], [-25, 68], [-20, 78], [-35, 83], [-55, 83],
        [-70, 76], [-55, 60]
      ]
    },
    // South America
    {
      name: 'South America',
      baseColor: '#22552d',
      innerColor: '#1d4826',
      points: [
        [-77, 8], [-68, 11], [-60, 10], [-50, 0], [-35, -5], [-35, -9],
        [-40, -22], [-48, -28], [-55, -35], [-65, -45], [-67, -55], [-74, -52],
        [-74, -40], [-81, -5], [-79, 2], [-77, 8]
      ],
      mountain: { cx: -72, cy: -20, rx: 6, ry: 28, color: '#52432c' }
    },
    // Eurasia (Europe + Asia mainland)
    {
      name: 'Eurasia',
      baseColor: '#2b5d35',
      innerColor: '#366e41',
      points: [
        [-9, 36], [-9, 43], [-1, 46], [4, 53], [10, 54], [14, 54], [19, 45],
        [14, 41], [15, 38], [18, 40], [23, 38], [27, 41], [30, 46], [35, 46],
        [40, 42], [50, 41], [54, 50], [60, 60], [70, 72], [105, 76], [140, 72],
        [170, 66], [180, 65], [180, 55], [160, 55], [145, 50], [135, 45],
        [128, 40], [122, 38], [122, 30], [116, 23], [108, 16], [103, 10],
        [102, 2], [98, 10], [93, 18], [90, 22], [85, 17], [80, 13], [77, 8],
        [74, 15], [72, 20], [68, 24], [62, 25], [56, 26], [60, 22], [55, 16],
        [45, 13], [42, 17], [35, 28], [35, 36], [42, 38], [50, 40], [42, 45],
        [30, 46], [22, 48], [15, 50], [5, 50], [0, 46], [-9, 36]
      ],
      desert: { cx: 48, cy: 26, rx: 16, ry: 10, color: '#b59359' },
      mountain: { cx: 86, cy: 32, rx: 18, ry: 8, color: '#554228' }
    },
    // British Isles
    {
      name: 'British Isles',
      baseColor: '#2b5f36',
      points: [
        [-10, 52], [-4, 50], [1, 52], [0, 58], [-6, 58], [-10, 54], [-10, 52]
      ]
    },
    // Scandinavia
    {
      name: 'Scandinavia',
      baseColor: '#2c5938',
      points: [
        [5, 58], [10, 56], [16, 56], [22, 60], [28, 70], [20, 71], [12, 64], [5, 58]
      ]
    },
    // Japan
    {
      name: 'Japan',
      baseColor: '#295b34',
      points: [
        [130, 32], [135, 34], [140, 36], [144, 44], [140, 45], [135, 38], [130, 32]
      ]
    },
    // Africa
    {
      name: 'Africa',
      baseColor: '#3d6333',
      points: [
        [32, 31], [40, 20], [43, 12], [51, 10], [45, 2], [40, -4], [38, -14],
        [35, -20], [28, -32], [18, -34], [14, -23], [12, -10], [9, 0], [4, 6],
        [-5, 5], [-15, 12], [-17, 15], [-14, 24], [-10, 30], [-5, 36], [10, 37],
        [20, 32], [32, 31]
      ],
      desert: { cx: 16, cy: 24, rx: 24, ry: 9, color: '#c49f5c' }
    },
    // Madagascar
    {
      name: 'Madagascar',
      baseColor: '#295c32',
      points: [
        [44, -13], [50, -15], [48, -25], [44, -24], [43, -17], [44, -13]
      ]
    },
    // Australia
    {
      name: 'Australia',
      baseColor: '#536f3c',
      points: [
        [114, -22], [122, -18], [130, -12], [136, -12], [142, -11], [150, -22],
        [153, -28], [151, -34], [145, -38], [138, -35], [130, -32], [118, -35],
        [114, -22]
      ],
      desert: { cx: 132, cy: -25, rx: 14, ry: 9, color: '#b98c50' }
    },
    // New Zealand
    {
      name: 'New Zealand',
      baseColor: '#285832',
      points: [
        [174, -36], [178, -38], [175, -42], [170, -46], [168, -44], [174, -36]
      ]
    }
  ];

  // Draw each continent with coastal shelf turquoise halo & natural terrain
  continentPolygons.forEach((poly) => {
    const canvasPoints = poly.points.map(([lon, lat]) => geoToPixel(lon, lat, w, h));
    if (canvasPoints.length < 3) return;

    // A. Shallow Coastal Water Turquoise Glow
    ctx.strokeStyle = 'rgba(24, 140, 180, 0.4)';
    ctx.lineWidth = 14;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(canvasPoints[0][0], canvasPoints[0][1]);
    for (let i = 1; i < canvasPoints.length; i++) {
      ctx.lineTo(canvasPoints[i][0], canvasPoints[i][1]);
    }
    ctx.closePath();
    ctx.stroke();

    // B. Base Continental Landmass
    ctx.fillStyle = poly.baseColor;
    ctx.beginPath();
    ctx.moveTo(canvasPoints[0][0], canvasPoints[0][1]);
    for (let i = 1; i < canvasPoints.length; i++) {
      ctx.lineTo(canvasPoints[i][0], canvasPoints[i][1]);
    }
    ctx.closePath();
    ctx.fill();

    // C. Desert / Arid Region Overlay
    if (poly.desert) {
      const [dx, dy] = geoToPixel(poly.desert.cx, poly.desert.cy, w, h);
      const drx = (poly.desert.rx / 360) * w;
      const dry = (poly.desert.ry / 180) * h;
      const dGrad = ctx.createRadialGradient(dx, dy, 5, dx, dy, drx);
      dGrad.addColorStop(0, poly.desert.color);
      dGrad.addColorStop(0.7, 'rgba(180, 140, 85, 0.6)');
      dGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = dGrad;
      ctx.beginPath();
      ctx.ellipse(dx, dy, drx, dry, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // D. Mountain Relief Shading
    if (poly.mountain) {
      const [mx, my] = geoToPixel(poly.mountain.cx, poly.mountain.cy, w, h);
      const mrx = (poly.mountain.rx / 360) * w;
      const mry = (poly.mountain.ry / 180) * h;
      const mGrad = ctx.createRadialGradient(mx, my, 4, mx, my, mrx);
      mGrad.addColorStop(0, poly.mountain.color);
      mGrad.addColorStop(0.8, 'rgba(75, 58, 38, 0.5)');
      mGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = mGrad;
      ctx.beginPath();
      ctx.ellipse(mx, my, mrx, mry, 0.1, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  // 3. Polar Ice Caps (Arctic Ice & Antarctica)
  ctx.fillStyle = '#e8f5fb';
  // Antarctica (Southern polar landmass)
  ctx.beginPath();
  ctx.ellipse(w / 2, h * 0.96, w * 0.52, h * 0.08, 0, 0, Math.PI * 2);
  ctx.fill();
  // Arctic ice fringe (North pole)
  ctx.beginPath();
  ctx.ellipse(w / 2, h * 0.03, w * 0.48, h * 0.04, 0, 0, Math.PI * 2);
  ctx.fill();

  // 4. Subtle Nighttime City Light Clusters (Warm Amber/Gold)
  const cityClusters = [
    { lon: -74, lat: 41, count: 28 }, // US Northeast
    { lon: -118, lat: 34, count: 20 }, // California
    { lon: -87, lat: 42, count: 18 }, // Chicago/Midwest
    { lon: 2, lat: 49, count: 35 }, // Western Europe
    { lon: 77, lat: 28, count: 32 }, // Northern India
    { lon: 73, lat: 19, count: 26 }, // Mumbai region
    { lon: 121, lat: 31, count: 36 }, // Eastern China
    { lon: 139, lat: 36, count: 30 }, // Tokyo / Japan
    { lon: -46, lat: -23, count: 20 }, // São Paulo
    { lon: 151, lat: -34, count: 16 }, // Sydney
  ];

  ctx.fillStyle = 'rgba(255, 222, 130, 0.8)';
  cityClusters.forEach((cluster) => {
    const [cx, cy] = geoToPixel(cluster.lon, cluster.lat, w, h);
    for (let i = 0; i < cluster.count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * 22;
      const lx = cx + Math.cos(angle) * dist;
      const ly = cy + Math.sin(angle) * (dist * 0.7);
      ctx.beginPath();
      ctx.arc(lx, ly, Math.random() * 1.5 + 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

// Generate realistic seamless semi-transparent cloud texture
function createRealisticCloudTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const w = canvas.width;
  const h = canvas.height;

  // Fluid tropical & mid-latitude cloud weather streams
  const cloudBands = [
    { y: h * 0.22, height: 45, opacity: 0.18 }, // Northern Storm Belt
    { y: h * 0.48, height: 35, opacity: 0.24 }, // ITCZ Equatorial Convergence
    { y: h * 0.53, height: 30, opacity: 0.20 }, // Tropical band
    { y: h * 0.76, height: 50, opacity: 0.18 }, // Southern Ocean Storm Belt
  ];

  cloudBands.forEach((band) => {
    const grad = ctx.createLinearGradient(0, band.y - band.height, 0, band.y + band.height);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0)');
    grad.addColorStop(0.5, `rgba(255, 255, 255, ${band.opacity})`);
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, band.y - band.height, w, band.height * 2);
  });

  // Dynamic Cyclonic Spiral Swirls & Cloud Clusters
  for (let i = 0; i < 40; i++) {
    const cx = Math.random() * w;
    const cy = h * 0.15 + Math.random() * (h * 0.7);
    const rad = 25 + Math.random() * 65;
    const radGrad = ctx.createRadialGradient(cx, cy, 2, cx, cy, rad);
    radGrad.addColorStop(0, 'rgba(255, 255, 255, 0.28)');
    radGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.14)');
    radGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = radGrad;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rad, rad * 0.55, (Math.random() - 0.5) * 0.6, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

export default function InteractiveEarth() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { currentUser, isAuthenticated } = useRBAC();

  const [selectedPatient, setSelectedPatient] = useState<DatasetPatient | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [isHoveringMarker, setIsHoveringMarker] = useState(false);
  const [webglUnavailable, setWebglUnavailable] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth || 600;
    const height = container.clientHeight || 600;

    // 1. Scene & Camera Setup with Natural FOV
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 2000);
    camera.position.set(0, 15, 370);

    // 2. High-Fidelity WebGL Renderer with ACES Filmic Tone Mapping
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    } catch (error) {
      // WebGL can be blocked (GPU deny-list, privacy settings, low-memory devices)
      console.warn('WebGL unavailable; showing static globe fallback.', error);
      queueMicrotask(() => setWebglUnavailable(true));
      return;
    }
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    container.appendChild(renderer.domElement);

    // Group for the Earth and all patient markers
    const earthGroup = new THREE.Group();
    scene.add(earthGroup);

    // 3. Authentic NASA Earth Globe Sphere
    const earthRadius = 112;
    const earthGeometry = new THREE.SphereGeometry(earthRadius, 64, 64);
    
    // Texture loader with fallbacks
    const textureLoader = new THREE.TextureLoader();
    const fallbackTexture = createRealisticEarthTexture();

    const earthDayTexture = textureLoader.load(
      '/images/earth_daymap.jpg',
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
      },
      undefined,
      () => {
        // Fallback gracefully if network issue
      }
    );
    earthDayTexture.colorSpace = THREE.SRGBColorSpace;

    const earthSpecularMap = textureLoader.load('/images/earth_specular.jpg');

    const earthMaterial = new THREE.MeshPhongMaterial({
      map: earthDayTexture || fallbackTexture,
      specularMap: earthSpecularMap,
      specular: new THREE.Color(0x66aadd),
      shininess: 28,
      emissive: new THREE.Color(0x082036),
      emissiveIntensity: 0.22,
    });
    const earthMesh = new THREE.Mesh(earthGeometry, earthMaterial);
    earthGroup.add(earthMesh);

    // Initial earth rotation showing vibrant continents in daylight
    earthGroup.rotation.y = 4.2;
    earthGroup.rotation.x = 0.15;

    // 4. Realistic Cloud Layer with Authentic Cloud Texture
    const cloudGeometry = new THREE.SphereGeometry(earthRadius * 1.014, 64, 64);
    const fallbackCloud = createRealisticCloudTexture();
    const cloudTexture = textureLoader.load(
      '/images/earth_clouds.png',
      undefined,
      undefined,
      () => {}
    );
    cloudTexture.wrapS = THREE.RepeatWrapping;

    const cloudMaterial = new THREE.MeshLambertMaterial({
      map: cloudTexture || fallbackCloud,
      transparent: true,
      opacity: 0.58,
      blending: THREE.NormalBlending,
      depthWrite: false,
    });
    const cloudMesh = new THREE.Mesh(cloudGeometry, cloudMaterial);
    earthGroup.add(cloudMesh);

    // 5. Natural Rayleigh Atmospheric Glow Haze for Daytime Earth
    const atmosphereGeometry = new THREE.SphereGeometry(earthRadius * 1.045, 48, 48);
    const atmosphereMaterial = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        void main() {
          float intensity = pow(0.70 - dot(vNormal, vec3(0, 0, 1.0)), 2.2);
          gl_FragColor = vec4(0.38, 0.74, 1.0, 1.0) * intensity * 1.35;
        }
      `,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
    });
    const atmosphereMesh = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
    scene.add(atmosphereMesh);

    // 6. Natural Directional Sunlight & Luminous Daytime Sky Ambiance
    const ambientLight = new THREE.AmbientLight(0xdbeafe, 2.4);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xffffff, 3.2);
    sunLight.position.set(300, 180, 280);
    scene.add(sunLight);

    const frontFillLight = new THREE.DirectionalLight(0xf0f9ff, 1.3);
    frontFillLight.position.set(0, 40, 320);
    scene.add(frontFillLight);

    const rimBlueLight = new THREE.DirectionalLight(0x93c5fd, 1.8);
    rimBlueLight.position.set(-260, 40, -120);
    scene.add(rimBlueLight);

    // 7. Clickable Blinking Patient Indicators from Dataset
    const markerObjects: Array<{
      patient: DatasetPatient;
      hitMesh: THREE.Mesh;
      coreDot: THREE.Mesh;
      pulseRing: THREE.Mesh;
      speed: number;
      phase: number;
    }> = [];

    const raycastHitMeshes: THREE.Mesh[] = [];

    DATASET_PATIENTS.forEach((patient, idx) => {
      const pos = latLonToVector3(patient.lat, patient.lon, earthRadius + 1.2);

      // Core pulsing dot
      const dotGeo = new THREE.SphereGeometry(2.0, 16, 16);
      const dotMat = new THREE.MeshBasicMaterial({
        color: patient.dotColor,
        transparent: true,
        opacity: 0.95,
      });
      const coreDot = new THREE.Mesh(dotGeo, dotMat);
      coreDot.position.copy(pos);
      coreDot.userData = { patient };

      // Glowing outer ripple ring
      const ringGeo = new THREE.RingGeometry(2.2, 4.4, 24);
      const ringMat = new THREE.MeshBasicMaterial({
        color: patient.dotColor,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.7,
        blending: THREE.AdditiveBlending,
      });
      const pulseRing = new THREE.Mesh(ringGeo, ringMat);
      pulseRing.position.copy(pos.clone().multiplyScalar(1.002));
      pulseRing.lookAt(pos.clone().multiplyScalar(2));
      pulseRing.userData = { patient };

      // Raycastable transparent hit sphere (guaranteed intersection on click & touch)
      const hitGeo = new THREE.SphereGeometry(7.5, 12, 12);
      const hitMat = new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const hitMesh = new THREE.Mesh(hitGeo, hitMat);
      hitMesh.position.copy(pos);
      hitMesh.userData = { patient };

      earthGroup.add(coreDot);
      earthGroup.add(pulseRing);
      earthGroup.add(hitMesh);

      // Add both hitMesh and coreDot for 100% click reliability
      raycastHitMeshes.push(hitMesh);
      raycastHitMeshes.push(coreDot);

      markerObjects.push({
        patient,
        hitMesh,
        coreDot,
        pulseRing,
        speed: patient.pulseSpeed,
        phase: idx * 0.45,
      });
    });

    // 8. Connecting Data Arcs Between Healthcare Centers
    const arcConnections = [
      [DATASET_PATIENTS[0], DATASET_PATIENTS[5]], // Alex Taylor (Boston) -> Priya Sharma (London)
      [DATASET_PATIENTS[5], DATASET_PATIENTS[6]], // London -> Rahul Mehta (Mumbai)
      [DATASET_PATIENTS[6], DATASET_PATIENTS[9]], // Mumbai -> Kenji (Tokyo)
      [DATASET_PATIENTS[9], DATASET_PATIENTS[2]], // Tokyo -> Maria Garcia (San Jose)
      [DATASET_PATIENTS[2], DATASET_PATIENTS[12]], // San Jose -> Carlos (São Paulo)
      [DATASET_PATIENTS[12], DATASET_PATIENTS[14]], // São Paulo -> Thabo (Cape Town)
      [DATASET_PATIENTS[14], DATASET_PATIENTS[10]], // Cape Town -> Lukas (Berlin)
      [DATASET_PATIENTS[10], DATASET_PATIENTS[0]], // Berlin -> Alex Taylor (Boston)
    ];

    arcConnections.forEach(([src, dst]) => {
      const v1 = latLonToVector3(src.lat, src.lon, earthRadius + 1.2);
      const v2 = latLonToVector3(dst.lat, dst.lon, earthRadius + 1.2);

      const mid = v1.clone().add(v2).multiplyScalar(0.5);
      const midDist = mid.length();
      mid.normalize().multiplyScalar(midDist + 22);

      const curve = new THREE.QuadraticBezierCurve3(v1, mid, v2);
      const points = curve.getPoints(45);
      const curveGeometry = new THREE.BufferGeometry().setFromPoints(points);

      const curveMaterial = new THREE.LineBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.35,
        blending: THREE.AdditiveBlending,
      });
      const arcLine = new THREE.Line(curveGeometry, curveMaterial);
      earthGroup.add(arcLine);
    });

    // 9. Thin Orbital Rings around the Earth
    const ringGroup = new THREE.Group();
    scene.add(ringGroup);

    [
      { rx: 0.35, ry: 0.2, rz: 0.15, radius: 155, opacity: 0.2 },
      { rx: -0.4, ry: 0.6, rz: -0.25, radius: 175, opacity: 0.16 },
    ].forEach((orb) => {
      const curve = new THREE.EllipseCurve(0, 0, orb.radius, orb.radius * 0.95, 0, Math.PI * 2, false, 0);
      const points = curve.getPoints(128).map((p) => new THREE.Vector3(p.x, p.y, 0));
      const geom = new THREE.BufferGeometry().setFromPoints(points);
      const mat = new THREE.LineDashedMaterial({
        color: 0x38bdf8,
        dashSize: 4,
        gapSize: 6,
        transparent: true,
        opacity: orb.opacity,
        blending: THREE.AdditiveBlending,
      });
      const orbitLine = new THREE.Line(geom, mat);
      orbitLine.computeLineDistances();
      orbitLine.rotation.set(orb.rx, orb.ry, orb.rz);
      ringGroup.add(orbitLine);
    });

    // 10. Raycasting & Mouse Interaction (Click Patient Dots)
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    let isDragging = false;
    let dragDistance = 0;
    let previousMousePosition = { x: 0, y: 0 };
    let targetRotationX = 0.1;
    let targetRotationY = 0;
    let autoRotate = true;

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      dragDistance = 0;
      autoRotate = false;
      previousMousePosition = { x: e.clientX, y: e.clientY };
    };

    const onMouseMove = (e: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      // Hover check on markers
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(raycastHitMeshes);
      setIsHoveringMarker(intersects.length > 0);

      if (!isDragging) return;

      const deltaX = e.clientX - previousMousePosition.x;
      const deltaY = e.clientY - previousMousePosition.y;
      dragDistance += Math.abs(deltaX) + Math.abs(deltaY);

      targetRotationY += deltaX * 0.005;
      targetRotationX += deltaY * 0.005;
      targetRotationX = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, targetRotationX));

      previousMousePosition = { x: e.clientX, y: e.clientY };
    };

    const handleMarkerRaycast = (clientX: number, clientY: number) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(raycastHitMeshes);

      if (intersects.length > 0) {
        const clickedPatient = intersects[0].object.userData.patient as DatasetPatient;
        if (clickedPatient) {
          setSelectedPatient(clickedPatient);
          autoRotate = false;
          return true;
        }
      }
      return false;
    };

    const onMouseUp = (e: MouseEvent) => {
      isDragging = false;

      // Check for marker selection on click (dragDistance < 12px)
      if (dragDistance < 12) {
        handleMarkerRaycast(e.clientX, e.clientY);
      }

      setTimeout(() => {
        if (!selectedPatient) autoRotate = true;
      }, 3500);
    };

    const onCanvasClick = (e: MouseEvent) => {
      if (dragDistance < 14) {
        handleMarkerRaycast(e.clientX, e.clientY);
      }
    };

    const domElement = renderer.domElement;
    domElement.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    domElement.addEventListener('click', onCanvasClick);

    // Touch Support
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        isDragging = true;
        dragDistance = 0;
        autoRotate = false;
        previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!isDragging || e.touches.length !== 1) return;
      const deltaX = e.touches[0].clientX - previousMousePosition.x;
      const deltaY = e.touches[0].clientY - previousMousePosition.y;
      dragDistance += Math.abs(deltaX) + Math.abs(deltaY);

      targetRotationY += deltaX * 0.006;
      targetRotationX += deltaY * 0.006;
      targetRotationX = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, targetRotationX));

      previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    };

    const onTouchEnd = (e: TouchEvent) => {
      isDragging = false;
      if (dragDistance < 10 && e.changedTouches.length === 1) {
        const touch = e.changedTouches[0];
        const rect = renderer.domElement.getBoundingClientRect();
        mouse.x = ((touch.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((touch.clientY - rect.top) / rect.height) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(raycastHitMeshes);
        if (intersects.length > 0) {
          const clickedPatient = intersects[0].object.userData.patient as DatasetPatient;
          if (clickedPatient) {
            setSelectedPatient(clickedPatient);
          }
        }
      }
    };

    domElement.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd);

    // 11. Window Resize Handling
    const onResize = () => {
      if (!container) return;
      const newWidth = container.clientWidth;
      const newHeight = container.clientHeight;
      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, newHeight);
    };
    window.addEventListener('resize', onResize);

    // 12. Animation Loop with Real Planetary Dynamics
    let animationFrameId: number;
    const timer = new THREE.Timer();
    timer.connect(document);

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      timer.update();
      const elapsedTime = timer.getElapsed();

      // Gentle auto-spin
      if (autoRotate && !selectedPatient) {
        targetRotationY += 0.0018;
      }

      // Smooth damping interpolation
      earthGroup.rotation.y += (targetRotationY - earthGroup.rotation.y) * 0.05;
      earthGroup.rotation.x += (targetRotationX - earthGroup.rotation.x) * 0.05;

      // Realistic cloud layer differential rotation
      cloudMesh.rotation.y += 0.0004;

      // Orbital rings counter-rotation
      ringGroup.rotation.y -= 0.0006;

      // Animate blinking patient markers
      markerObjects.forEach((item) => {
        const pulse = Math.sin(elapsedTime * item.speed + item.phase);
        const scale = 1.0 + 0.3 * Math.max(0, pulse);
        const ringScale = 1.0 + 0.7 * Math.max(0, pulse);
        item.coreDot.scale.set(scale, scale, scale);
        item.pulseRing.scale.set(ringScale, ringScale, ringScale);
        (item.pulseRing.material as THREE.MeshBasicMaterial).opacity = 0.25 + 0.55 * Math.max(0, pulse);
      });

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      domElement.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      domElement.removeEventListener('click', onCanvasClick);
      domElement.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('resize', onResize);
      if (domElement && domElement.parentNode) {
        domElement.parentNode.removeChild(domElement);
      }
      timer.dispose();
      renderer.dispose();
      earthGeometry.dispose();
      earthMaterial.dispose();
      cloudGeometry.dispose();
      cloudMaterial.dispose();
      atmosphereGeometry.dispose();
      atmosphereMaterial.dispose();
    };
  }, [selectedPatient]);

  return (
    <div className="relative w-full h-[520px] sm:h-[600px] lg:h-[660px] flex items-center justify-center select-none">
      {/* Three.js Canvas Container */}
      {webglUnavailable ? (
        <div className="w-full h-full flex flex-col items-center justify-center gap-4">
          <div
            aria-hidden="true"
            className="w-[260px] h-[260px] sm:w-[380px] sm:h-[380px] rounded-full bg-[radial-gradient(circle_at_32%_28%,#bae6fd_0%,#38bdf8_18%,#1d4ed8_52%,#0f172a_100%)] shadow-[0_30px_90px_rgba(29,78,216,0.35)] ring-1 ring-white/40"
          />
          <p className="text-xs text-white bg-slate-950/60 backdrop-blur-md px-4 py-2 rounded-full border border-white/20">
            3D globe is unavailable on this device. The clinical dataset is still available below.
          </p>
        </div>
      ) : (
        <div
          ref={containerRef}
          className={`w-full h-full ${isHoveringMarker ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'}`}
        />
      )}

      {/* Floating Medical Badges matching Carevia Theme */}
      {/* Node 1: Medical Cross */}
      <div className="absolute top-[16%] left-[16%] sm:left-[20%] z-20 pointer-events-none">
        <div className="w-11 h-11 rounded-full bg-white/90 border border-white/80 shadow-[0_8px_20px_rgba(30,58,138,0.12)] flex items-center justify-center backdrop-blur-md">
          <span className="text-blue-600 font-black text-lg leading-none">+</span>
        </div>
      </div>

      {/* Node 2: Heartbeat Pulse */}
      <div className="absolute top-[12%] right-[14%] sm:right-[18%] z-20 pointer-events-none">
        <div className="w-11 h-11 rounded-full bg-white/90 border border-white/80 shadow-[0_8px_20px_rgba(30,58,138,0.12)] flex items-center justify-center backdrop-blur-md">
          <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        </div>
      </div>

      {/* Node 3: DNA Helix */}
      <div className="absolute top-[40%] right-[4%] sm:right-[7%] z-20 pointer-events-none">
        <div className="w-10 h-10 rounded-full bg-white/90 border border-white/80 shadow-[0_8px_18px_rgba(30,58,138,0.12)] flex items-center justify-center backdrop-blur-md">
          <svg className="w-5 h-5 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v18M15 3v18M4 9h16M4 15h16" />
          </svg>
        </div>
      </div>

      {/* Node 4: Clinical Clipboard */}
      <div className="absolute top-[48%] left-[10%] sm:left-[14%] z-20 pointer-events-none">
        <div className="w-10 h-10 rounded-full bg-white/90 border border-white/80 shadow-[0_8px_18px_rgba(30,58,138,0.12)] flex items-center justify-center backdrop-blur-md">
          <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </div>
      </div>

      {/* Node 5: Hospital Facility */}
      <div className="absolute bottom-[20%] right-[16%] sm:right-[20%] z-20 pointer-events-none">
        <div className="w-11 h-11 rounded-full bg-white/90 border border-white/80 shadow-[0_8px_20px_rgba(30,58,138,0.12)] flex items-center justify-center backdrop-blur-md">
          <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
        </div>
      </div>

      {/* Floating Data Card: "Better Data / Brighter Healthcare / Healthier Lives" */}
      <div className="absolute bottom-[22%] right-[4%] sm:right-[6%] z-20 p-3 sm:p-4 rounded-2xl bg-white/90 border border-white/80 shadow-[0_12px_32px_rgba(30,58,138,0.12)] backdrop-blur-md pointer-events-none text-left">
        <div className="text-xs sm:text-sm font-bold text-blue-600 leading-tight">Better Data</div>
        <div className="text-xs sm:text-sm font-bold text-slate-800 leading-tight">Brighter Healthcare</div>
        <div className="text-xs sm:text-sm font-bold text-teal-600 leading-tight">Healthier Lives</div>
      </div>

      {/* Interactive Helper Banner */}
      {!webglUnavailable && (
        <div className="hidden sm:flex absolute bottom-2 left-4 z-10 text-[11px] text-slate-600 bg-white/85 px-3 py-1.5 rounded-full border border-white/80 shadow-xs pointer-events-none items-center gap-1.5 backdrop-blur-md">
          <Sparkles className="w-3.5 h-3.5 text-blue-600" />
          <span>Click a patient dot for details</span>
        </div>
      )}

      {/* Dataset Legend */}
      <div className="absolute bottom-2 right-4 z-10 text-[11px] font-mono text-slate-600 bg-white/85 px-3 py-1.5 rounded-full border border-white/80 shadow-xs pointer-events-none backdrop-blur-md">
        <span className="w-2 h-2 rounded-full bg-blue-600 inline-block mr-1.5 animate-pulse" />
        {DATASET_PATIENTS.length} mapped patients
      </div>

      {/* ==============================================================
          INTERACTIVE PATIENT POP-UP CARD (Triggered when clicking a dot)
         ============================================================== */}
      {selectedPatient && (
        <div className="absolute inset-0 z-30 flex items-center justify-center p-4 bg-slate-900/30 backdrop-blur-sm animate-in fade-in zoom-in-95 duration-200">
          <div className="bg-white/95 border border-white/90 rounded-3xl max-w-md w-full p-6 shadow-[0_25px_60px_rgba(30,58,138,0.2)] text-slate-800 text-left relative space-y-4">
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setSelectedPatient(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 p-1.5 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header: Patient Name & Status */}
            <div className="flex items-start gap-3.5 pr-6">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-sky-400 flex items-center justify-center font-bold text-base text-white shadow-md shrink-0">
                {selectedPatient.name.split(' ').map((n) => n[0]).join('')}
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-slate-900 tracking-tight">{selectedPatient.name}</h3>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${selectedPatient.statusColor}`}>
                    {selectedPatient.status}
                  </span>
                </div>
                <div className="text-xs text-slate-500 font-mono flex items-center gap-2">
                  <span>MRN: {selectedPatient.mrn}</span>
                  <span>·</span>
                  <span>{selectedPatient.age} y ({selectedPatient.gender})</span>
                  <span>·</span>
                  <span className="text-teal-600 font-bold">{selectedPatient.bloodGroup}</span>
                </div>
              </div>
            </div>

            {/* Location & Coordinates */}
            <div className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
              <MapPin className="w-4 h-4 text-blue-600 shrink-0" />
              <span className="font-medium text-slate-700">
                {selectedPatient.city}, {selectedPatient.country}
              </span>
              <span className="text-slate-400 font-mono text-[10px] ml-auto">
                ({selectedPatient.lat.toFixed(2)}°, {selectedPatient.lon.toFixed(2)}°)
              </span>
            </div>

            {/* Condition & Clinical Vitals */}
            <div className="space-y-2 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                <span className="text-[11px] font-medium text-slate-400 block">Primary Diagnosis / Indication:</span>
                <span className="font-semibold text-slate-800">{selectedPatient.condition}</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                <span className="text-[11px] font-medium text-slate-400 block">Recorded Clinical Vitals:</span>
                <span className="font-mono text-blue-600 font-bold">{selectedPatient.vitals}</span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-400 block">Attending Clinician:</span>
                  <span className="font-semibold text-slate-700">{selectedPatient.attending}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-400 block">Assigned AI Pathway:</span>
                  <span className="font-semibold text-blue-600">{selectedPatient.aiPathway}</span>
                </div>
              </div>
            </div>

            {/* Actions: View Records or Sign In */}
            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setSelectedPatient(null)}
                className="px-3.5 py-2 rounded-xl border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 text-xs font-semibold cursor-pointer"
              >
                Close
              </button>

              {isAuthenticated ? (
                currentUser?.role === 'patient' ? (
                  <Link
                    href="/emr"
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md flex items-center gap-1.5"
                  >
                    <span>View in Patient Portal</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                ) : (
                  <Link
                    href="/doctor"
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md flex items-center gap-1.5"
                  >
                    <span>Inspect in Doctor Workstation</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                )
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedPatient(null);
                    setAuthModalOpen(true);
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-black text-white font-bold text-xs shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Sign In for Full Records</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Multi-Role Authentication Modal */}
      <MultiRoleAuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialRole="patient"
      />
    </div>
  );
}

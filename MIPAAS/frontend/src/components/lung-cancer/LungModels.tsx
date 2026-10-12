'use client';

import { useState } from 'react';

const models = [
  {
    id: 'sybil',
    name: 'Sybil Ensemble',
    origin: 'MIT / Barzilaygroup',
    repo: 'github.com/reginabarzilaygroup/Sybil',
    type: 'Risk Prediction',
    arch: 'Video Transformer + 3D CNN Ensemble',
    input: 'Full LDCT series (80-200 slices)',
    output: '1-6 year cancer probability curve',
    training: 'NLST (26,722 patients, 6 years follow-up)',
    xai: ['Grad-CAM++', 'Attention Maps'],
    metrics: [
      { label: 'AUC (1yr)', value: '0.92' },
      { label: 'AUC (6yr)', value: '0.94' },
      { label: 'C-index', value: '0.88' },
    ],
    color: '#00DCCE',
  },
  {
    id: 'resnet3d',
    name: '3D ResNet-50',
    origin: 'MONAI / MiPAAS Custom',
    repo: 'github.com/Project-MONAI/MONAI',
    type: 'Nodule Classification',
    arch: '3D ResNet-50 with ResBlock + Bottleneck',
    input: 'Cropped 3D nodule patch (64×64×64)',
    output: 'Benign / Malignant + confidence',
    training: 'LIDC-IDRI (1,018 scans, 2,669 nodules)',
    xai: ['Grad-CAM++', 'Occlusion Sensitivity'],
    metrics: [
      { label: 'Accuracy', value: '96.8%' },
      { label: 'AUC', value: '0.98' },
      { label: 'F1 Score', value: '0.95' },
    ],
    color: '#FF7869',
  },
  {
    id: 'densenet3d',
    name: '3D DenseNet-121',
    origin: 'MiPAAS Custom Architecture',
    repo: 'Custom implementation',
    type: 'Multi-class Classification',
    arch: '3D DenseNet with DenseBlock + Transition layers',
    input: 'Full lung volume (128×128×128)',
    output: 'Normal / GGO / Solid / Part-solid / Calcified',
    training: 'Internal + LUNA16 (888 scans)',
    xai: ['Integrated Gradients', 'Grad-CAM++'],
    metrics: [
      { label: 'Accuracy', value: '94.2%' },
      { label: 'AUC (macro)', value: '0.96' },
      { label: 'Sensitivity', value: '93.1%' },
    ],
    color: '#98AED9',
  },
];

export default function LungModels() {
  const [activeModel, setActiveModel] = useState(models[0].id);
  const model = models.find((m) => m.id === activeModel)!;

  return (
    <section className="bg-[#0A1823] py-20 lg:py-28">
      <div className="mx-auto max-w-[81rem] px-6 md:px-8 xl:px-0">
        {/* Header */}
        <div className="text-center mb-14">
          <span className="text-xs font-semibold tracking-[0.2em] uppercase text-[#FF7869]">
            Model Registry
          </span>
          <h2
            className="text-3xl sm:text-4xl lg:text-5xl text-white mt-3 mb-4"
            style={{ fontFamily: "'Josefin Sans', sans-serif", fontWeight: 700 }}
          >
            Pre-Trained Models
          </h2>
          <p className="text-gray-400 max-w-xl mx-auto">
            Each model is sourced from peer-reviewed research, weights are stored in GCS, and
            loaded via our adapter pattern for plug-and-play inference.
          </p>
        </div>

        {/* Model tabs */}
        <div className="flex flex-wrap justify-center gap-3 mb-10">
          {models.map((m) => (
            <button
              key={m.id}
              onClick={() => setActiveModel(m.id)}
              className={`relative rounded-full px-6 py-2.5 text-sm font-medium transition-all duration-300 cursor-pointer ${
                activeModel === m.id
                  ? 'text-white shadow-lg'
                  : 'text-gray-400 hover:text-white bg-white/[0.03] border border-white/5 hover:border-white/10'
              }`}
              style={
                activeModel === m.id
                  ? {
                      backgroundColor: `${m.color}20`,
                      borderColor: `${m.color}40`,
                      border: `1px solid ${m.color}40`,
                      boxShadow: `0 0 20px ${m.color}15`,
                    }
                  : {}
              }
            >
              {m.name}
            </button>
          ))}
        </div>

        {/* Model detail card */}
        <div
          key={model.id}
          className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden transition-all duration-500"
        >
          {/* Top bar */}
          <div
            className="h-1"
            style={{ background: `linear-gradient(to right, ${model.color}, ${model.color}40)` }}
          />

          <div className="p-8 lg:p-10">
            {/* Header row */}
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-2xl font-bold text-white">{model.name}</h3>
                  <span
                    className="text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-md"
                    style={{
                      color: model.color,
                      backgroundColor: `${model.color}15`,
                    }}
                  >
                    {model.type}
                  </span>
                </div>
                <div className="text-sm text-gray-400">{model.origin}</div>
                <div className="text-xs text-gray-500 font-mono mt-1">{model.repo}</div>
              </div>

              {/* Metrics pills */}
              <div className="flex flex-wrap gap-3">
                {model.metrics.map((metric) => (
                  <div
                    key={metric.label}
                    className="rounded-xl bg-white/[0.03] border border-white/5 px-4 py-3 text-center min-w-[100px]"
                  >
                    <div
                      className="text-xl font-bold"
                      style={{ fontFamily: "'Josefin Sans', sans-serif", color: model.color }}
                    >
                      {metric.value}
                    </div>
                    <div className="text-[10px] text-gray-500 uppercase tracking-wider mt-0.5">
                      {metric.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Detail grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {[
                { label: 'Architecture', value: model.arch, icon: '🧠' },
                { label: 'Input Format', value: model.input, icon: '📥' },
                { label: 'Output', value: model.output, icon: '📊' },
                { label: 'Training Data', value: model.training, icon: '🗃️' },
              ].map((d) => (
                <div
                  key={d.label}
                  className="rounded-xl bg-white/[0.02] border border-white/5 p-5"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm">{d.icon}</span>
                    <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">
                      {d.label}
                    </span>
                  </div>
                  <div className="text-sm text-gray-300 leading-relaxed">{d.value}</div>
                </div>
              ))}
            </div>

            {/* XAI methods */}
            <div className="mt-6 pt-6 border-t border-white/5">
              <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">
                Explainability Methods
              </span>
              <div className="flex flex-wrap gap-2 mt-2">
                {model.xai.map((method) => (
                  <span
                    key={method}
                    className="rounded-lg px-3 py-1.5 text-xs font-medium border"
                    style={{
                      color: model.color,
                      borderColor: `${model.color}30`,
                      backgroundColor: `${model.color}08`,
                    }}
                  >
                    {method}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

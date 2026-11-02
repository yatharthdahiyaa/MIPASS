"""
Adapter Factory — Resolves adapter class names to instances.

This is the single registration point for all model adapters.
When you create a new adapter, register it here.
"""

from workers.adapters.base_adapter import BaseModelAdapter
from workers.adapters.sybil_adapter import SybilAdapter
from workers.adapters.resnet3d_adapter import ResNet3DAdapter
from workers.adapters.densenet3d_adapter import DenseNet3DAdapter
from workers.adapters.chexnet_adapter import CheXNetAdapter
from workers.adapters.skin_lesion_adapter import SkinLesionAdapter
from workers.adapters.diabetic_foot_adapter import DiabeticFootAdapter


# ──────────────────────────────────────────────────────────────
# ADAPTER REGISTRY
# To add a new model: import it above and add to this dict.
# The key must match the 'adapter' field in the disease YAML.
# ──────────────────────────────────────────────────────────────
ADAPTER_REGISTRY: dict[str, type[BaseModelAdapter]] = {
    "SybilAdapter": SybilAdapter,
    "ResNet3DAdapter": ResNet3DAdapter,
    "DenseNet3DAdapter": DenseNet3DAdapter,
    "CheXNetAdapter": CheXNetAdapter,
    "ChestXRayAdapter": CheXNetAdapter,
    "SkinLesionAdapter": SkinLesionAdapter,
    "DiabeticFootAdapter": DiabeticFootAdapter,
}


def get_adapter(adapter_name: str, **kwargs) -> BaseModelAdapter:
    """Instantiate a model adapter by class name.

    Args:
        adapter_name: Adapter class name (must be registered in ADAPTER_REGISTRY).
        **kwargs: Additional arguments passed to the adapter constructor.

    Returns:
        Instantiated model adapter.

    Raises:
        ValueError: If adapter_name is not registered.
    """
    adapter_cls = ADAPTER_REGISTRY.get(adapter_name)
    if adapter_cls is None:
        available = list(ADAPTER_REGISTRY.keys())
        raise ValueError(
            f"Unknown adapter: {adapter_name}. "
            f"Available adapters: {available}. "
            f"Register new adapters in workers/adapters/factory.py"
        )
    return adapter_cls(**kwargs)

"""Loading saved models (the same fix as QuickCast's model_io.py).

Stable-Baselines3 (2.9) hands torch.load the files inside a saved model as streams read straight
out of the zip, which this PyTorch (2.14) can't read ("PytorchStreamReader failed reading file
.data/serialization_id"). load_model reads each one into memory first.
"""
import io

import torch
from sb3_contrib import MaskablePPO


def load_model(path, **kwargs) -> MaskablePPO:
    original_load = torch.load

    def load_from_memory(file, *args, **load_kwargs):
        if hasattr(file, "read") and not isinstance(file, io.BytesIO):
            file = io.BytesIO(file.read())
        return original_load(file, *args, **load_kwargs)

    torch.load = load_from_memory
    try:
        return MaskablePPO.load(path, **kwargs)
    finally:
        torch.load = original_load

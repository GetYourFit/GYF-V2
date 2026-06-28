"""Accelerator selection — one place, shared by every torch-backed estimator."""

from __future__ import annotations


def select_device() -> str:
    """Most capable accelerator, excluding Apple MPS (repo device convention).

    MPS is deliberately skipped: the vision/segmentation stacks GYF runs hit
    correctness and dtype gaps on Metal, so we prefer CUDA → Intel XPU → CPU.
    ``torch`` is imported lazily so importing this module needs no heavy deps.
    """
    import torch

    if torch.cuda.is_available():
        return "cuda"
    if hasattr(torch, "xpu") and torch.xpu.is_available():
        return "xpu"
    return "cpu"

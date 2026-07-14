from collections.abc import Sequence


def _edit_distance(reference: Sequence[str], prediction: Sequence[str]) -> int:
    previous = list(range(len(prediction) + 1))

    for i, ref_item in enumerate(reference, start=1):
        current = [i]
        for j, pred_item in enumerate(prediction, start=1):
            substitution = previous[j - 1] + (ref_item != pred_item)
            insertion = current[j - 1] + 1
            deletion = previous[j] + 1
            current.append(min(substitution, insertion, deletion))
        previous = current

    return previous[-1]


def character_error_rate(reference: str, prediction: str) -> float:
    if not reference:
        return 0.0 if not prediction else 1.0

    return _edit_distance(list(reference), list(prediction)) / len(reference)


def word_error_rate(reference: str, prediction: str) -> float:
    reference_words = reference.split()
    prediction_words = prediction.split()

    if not reference_words:
        return 0.0 if not prediction_words else 1.0

    return _edit_distance(reference_words, prediction_words) / len(reference_words)


if __name__ == "__main__":
    assert character_error_rate("abc", "adc") == 1 / 3
    assert word_error_rate("hello world", "hello thai") == 1 / 2
    assert character_error_rate("", "") == 0.0
    print("metrics self-check passed")

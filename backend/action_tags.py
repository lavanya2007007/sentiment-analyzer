def get_action_tag(comment):

    text = comment.lower()

    if (
        "road" in text
        or "bridge" in text
        or "drainage" in text
        or "infrastructure" in text
    ):
        return "Infrastructure"

    elif (
        "water" in text
        or "river" in text
        or "supply" in text
    ):
        return "Water"

    elif (
        "hospital" in text
        or "doctor" in text
        or "health" in text
        or "medical" in text
    ):
        return "Healthcare"

    elif (
        "school" in text
        or "college" in text
        or "education" in text
        or "student" in text
    ):
        return "Education"

    elif (
        "electricity" in text
        or "power" in text
        or "current" in text
    ):
        return "Electricity"

    else:
        return "General"
    
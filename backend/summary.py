def generate_summary(keywords):

    if not keywords:
        return "No important topics found."

    summary = "Main discussion topics are: "

    summary += ", ".join(keywords[:3])

    return summary
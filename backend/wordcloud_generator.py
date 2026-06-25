from wordcloud import WordCloud
import matplotlib.pyplot as plt
import random

def generate_wordcloud(text):

    # Random background color
    colors = ["white", "black", "lightblue", "lightyellow"]

    background = random.choice(colors)

    wordcloud = WordCloud(
        width=800,
        height=400,
        background_color=background,
        colormap="viridis"
    ).generate(text)

    # Clear previous plot
    plt.clf()

    # Save NEW image
    wordcloud.to_file("wordcloud.png")

    return "wordcloud.png"
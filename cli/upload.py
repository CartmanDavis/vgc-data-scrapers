import requests
import argparse
import sqlite3
from pathlib import Path
from datetime import datetime


def upload_paste(paste, title="", author="", notes=""):
    paste = paste.replace("\n", "\r\n")
    data = {"paste": paste, "title": title, "author": author, "notes": notes}
    response = requests.post(
        "https://pokepast.es/create", data=data, allow_redirects=True
    )
    return response.url


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Upload a Pokemon team paste to pokepast.es"
    )
    parser.add_argument("--paste", help="The team paste content")
    parser.add_argument("--author", default="", help="Author of the paste")
    parser.add_argument("--title", default="", help="Title of the paste")
    parser.add_argument("--notes", default="", help="Notes for the paste")

    args = parser.parse_args()

    url = upload_paste(args.paste, args.title, args.author, args.notes)
    print(url)


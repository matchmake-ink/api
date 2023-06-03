from flask import Flask, request

app = Flask(__name__)


@app.route('/')
def index():
    # this is an incredibly naive solution, but it should be fine
    if request.args['key'] != 'my-secret-key':
        return 'Invalid key'

    # Process the matches here

    return 'Matches processed and updated!'


app.run(debug=True)

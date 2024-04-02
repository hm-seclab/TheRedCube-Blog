---
date: 2021-09-25
author: Julian Krieger
timeline: false
---

# RobertIsAGangsta

This CTF challenge is actually a three parter. It is a python file with the following contents relevant to the challenge:

```python
def validate_command(string):
    return len(string) == 4 and string.index("date") == 0

def api_admin(data, user):
    if user is None:
        return error_msg("Not logged in")
    is_admin = get_userdb().is_admin(user["email"])
    if not is_admin:
        return error_msg("User is not Admin")

    cmd = data["data"]["cmd"]
    # currently only "date" is supported
    if validate_command(cmd):
        out = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
        return success_msg(out.stdout.decode())

    return error_msg("invalid command")

@app.route("/json_api", methods=["GET", "POST"])
def json_api():
    user = get_user(request)
    if request.method == "POST":
        data = json.loads(request.get_data().decode())
        # print(data)
        action = data.get("action")
        if action is None:
            return "missing action"

        return actions.get(action, api_error)(data, user)

    else:
        return json.dumps(user)

def is_admin(self, email):
    user = self.db.get(email)
    if user is None:
        return False

    # TODO check userid type etc
    return user["userid"] > 90000000

def api_create_account(data, user):
    dt = data["data"]
    email = dt["email"]
    password = dt["password"]
    groupid = dt["groupid"]
    userid = dt["userid"]
    activation = dt["activation"]

    assert len(groupid) == 3
    assert len(userid) == 4

    userid = json.loads("1" + groupid + userid)

def check_activation_code(activation_code):
    # no bruteforce
    time.sleep(20)
    if "{:0>4}".format(random.randint(0, 10000)) in activation_code:
        return True
    else:
        return False
```

The target is a python webapp written in flask. Luckily, the organizers wrapped it in a docker container so we can run it ourselves. 

Starting the docker container is fairly easy.

```bash
  docker build -t robertisagansta && docker run -it -p 5000:5000 robertisagangsta
```

When visiting `localhost:5000`, we are greeted with a fairly basic entry screen.
Naturally, our first instinct would be to register an account. We immediately notic a pretty bad delay when clicking the submit button.
An info text gives us a hint: Trying to register an account has a built in delay of 20 seconds. 
After the 20 seconds are up, we are greeted with another info box: Creating our user fails, because we do not have the needed activation code. 
There is no further hint about what a correct information code would entail in the challenge's description. However, since we are in the posession
of our webapp's source code, we can just look up how the activation code validation logic works!

```python
  def check_activation_code(activation_code):
    # no bruteforce
    time.sleep(20)
    if "{:0>4}".format(random.randint(0, 10000)) in activation_code:
        return True
    else:
        return False
```

Huh, seems like the activation code is generated at random at runtime in form of a 4 digit number. We *could* try to brute force this number by sending the same request over and over and 
hoping that the RNG generates a match. The 20 second timer isn't much of as much of a showstopper as you might think. Even though the webapp is running in a single thread, something like 10000 requests should be handled pretty easy.
There is a much smarter way though: Let's have a look at how `check_activation_code` is called. When we open the browsers developer tools to check what endpoint is called when we try to register a user, we can see
that it sends a POST request to the route `http://localhost:5000/json_api`. This matches with the `json_api` function in `app.py`.

```python
  
@app.route("/json_api", methods=["GET", "POST"])
def json_api():
    user = get_user(request)
    if request.method == "POST":
        data = json.loads(request.get_data().decode())
        # print(data)
        action = data.get("action")
        if action is None:
            return "missing action"

        return actions.get(action, api_error)(data, user)

    else:
        return json.dumps(user)
```

`json_api` is pretty simple: First, it tries to get the current session's user instance. Then, it decodes the JSON in our POST request's body and loads it into a `data` dictionary.
Our json data needs to include an `action` key with a value of `create_account` if we want to call the `api_create_account` function.
We also need to include a `data` key with the data that is needed in `api_create_account`.

```python
def api_create_account(data, user):
    dt = data["data"]
    email = dt["email"]
    password = dt["password"]
    groupid = dt["groupid"]
    userid = dt["userid"]
    activation = dt["activation"]

    assert len(groupid) == 3
    assert len(userid) == 4

    userid = json.loads("1" + groupid + userid)

    if not check_activation_code(activation):
        return error_msg("Activation Code Wrong")
    # print("activation passed")

    if get_userdb().add_user(email, userid, password):
        # print("user created")
        return success_msg("User Created")
    else:
        return error_msg("User creation failed")
```

`api_create_account` has a single job: It checks if the activation code is valid and if it is, it creates our user in the database.
Now, on to our first problem: How can we manipulate data so that the activation code matches what we need? 
There are actually two ways to solve this! 

One way could be to write a small script that generates all numbers from `0000` to `9999` and concatenate them into a string.

```python
import itertools
list = map(lambda x: ''.join(map(str, x)), itertools.product(range(10), repeat=4)))
print(map(lambda x: ''.join(x), list))
```

This prints out all numbers into a gigantic string. We can copy that, paste it into the activation code input field and send it over to the server.
If we do that and wait, we can see that our account has been successfully created!
By the way, we could've also just copied `list` directly. An array of numbers is valid JSON, and `json.loads` wouldve turned the activation code entry
into a list inside `json_api`. Since the `in` check in `check_activation_code` also works on lists, this would've worked as well.
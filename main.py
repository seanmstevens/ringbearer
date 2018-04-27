from flask import Flask, request, redirect, render_template, url_for, session, flash, jsonify, Markup, abort, make_response
from flask_sqlalchemy import SQLAlchemy
from whitenoise import WhiteNoise
from hashutils import *
import re
from faker import Faker
import random
import sys
from datetime import datetime
from sqlalchemy import create_engine, func
from globals import statelist, typelist
import os

engine = create_engine('sqlite:///association_tables.sqlite')

from sqlalchemy.orm import sessionmaker
#session = sessionmaker()
#session.configure(bind=engine)

app = Flask(__name__)
app.config['DEBUG'] = True
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get("DATABASE_URL", 'mysql+pymysql://admin:Password1@ringbearer.cl1lubxzpscn.us-east-2.rds.amazonaws.com/wedplan')
app.config['SQLALCHEMY_ECHO'] = True
db = SQLAlchemy(app)
app.secret_key = "246Pass"

app.wsgi_app = WhiteNoise(app.wsgi_app, root='static/')

VENDOR_TYPES = {"venue": 1,
                "photographer": 2,
                "videographer": 3,
                "caterer": 4,
                "music": 5,
                "cosmetics": 6,
                "tailor": 7}

class UserVendor(db.Model):
    __tablename__ = 'user_vendor'
    id = db.Column(db.Integer, primary_key=True)
    vendor_id = db.Column(db.Integer, db.ForeignKey('vendor.id')) # primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id')) # primary_key=True)
    bookedDate = db.Column(db.Date)
    eventStartTime = db.Column(db.Time)
    eventEndTime = db.Column(db.Time)
    fullDay = db.Column(db.Boolean, default=False)
    enabled = db.Column(db.Boolean, default=True)
    vendor = db.relationship('Vendor', backref="user_assoc")
    user = db.relationship('User', backref="vendor_assoc")

    def __init__(self, vendor_id, user_id, bookedDate, eventStartTime, eventEndTime, fullDay, enabled):
        self.vendor_id = vendor_id
        self.user_id = user_id
        self.bookedDate = bookedDate
        self.eventStartTime = eventStartTime
        self.eventEndTime = eventEndTime
        self.fullDay = False
        self.enabled = True


class Vendor(db.Model):
    __tablename__ = 'vendor'
    id = db.Column(db.Integer, primary_key=True)
    businessName = db.Column(db.String(100))
    contactName = db.Column(db.String(50))
    email = db.Column(db.String(50))
    streetAddress = db.Column(db.String(100))
    city = db.Column(db.String(50))
    zipcode = db.Column(db.Integer)
    rating = db.Column(db.Float)
    vendorType = db.Column(db.String(50))
    rate = db.Column(db.BIGINT)
    password = db.Column(db.String(100))
    state = db.Column(db.String(2))
    users = db.relationship(
        'User',
        secondary='user_vendor'
    )


    def __init__(self, email, businessName, contactName, streetAddress, city, zipcode, rating, vendorType, rate, password, state):
        self.businessName = businessName
        self.contactName = contactName
        self.email = email
        self.streetAddress = streetAddress
        self.city = city
        self.zipcode = zipcode
        self.rating = rating
        self.vendorType = vendorType
        self.rate = rate
        self.password = password
        self.state = state

class User(db.Model):
    __tablename__ = 'user'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100))
    email = db.Column(db.String(50))
    phoneNumber = db.Column(db.BIGINT)
    password = db.Column(db.String(100))
    numberOfGuests = db.Column(db.Integer)
    eventDate = db.Column(db.Date)
    budget = db.Column(db.BIGINT)
    totalSpending = db.Column(db.BIGINT)
    vendors = db.relationship(
        'Vendor',
        secondary='user_vendor'
    )

    def __init__(self, name, email, password):
        self.name = name
        self.email = email
        self.password = password

@app.before_request
def require_login():
    blacklist = ['user', 'profile', 'book']
    if all([request.endpoint in blacklist, 'email' not in session, '/static/' not in request.path]):
        message = Markup("You must to be <strong>logged in</strong> to access this page.")
        flash(message, "is-danger")

        return redirect(url_for('login', next=request.endpoint))

def bad_request(message, data=None):
    response = jsonify({
        'message': message,
        'data': data
    })
    response.status_code = 401
    return response

@app.route('/session')
def getUserSessionDetails():
    if session.get('email', False):
        details = {}
        user_email = session['email']

        # Check if person in session is a normal user
        user = User.query.filter_by(email=user_email).first()

        if user:
            user_name = user.name
            user_type = "user"
        else:
            # Check if they're a vendor
            vendor = Vendor.query.filter_by(email=user_email).first()
            user_name = vendor.contactName
            user_type = "vendor"

        details['user_email'] = user_email
        details['user_name'] = user_name
        details['user_type'] = user_type

        # Check if the source of the request is an ajax call
        if request.args.get("source") == "ajax":
          return jsonify(details)

        return details
    if request.args.get("source") == "ajax":
      return jsonify(session=False)

    return False

def redirect_dest(fallback):
    dest = request.args.get('next')
    try:
        dest_url = url_for(dest)
    except:
        return redirect(fallback)
    print(dest_url)
    return redirect(dest_url)

@app.route('/login', methods=['GET', 'POST'])
def login():
    # Don't want users to be able to log in twice
    if session.get('email', False):
        return redirect(session['url'])

    (emailErrors, passErrors) = (None, None)
    errors = {'emailErrors': emailErrors,
              'passErrors': passErrors} # initializing errors object

    if request.method == 'POST':
        email = request.form['email'] #get email/pass
        password = request.form['password']
        user = User.query.filter_by(email=email).first() # check if email in use yet
        vendor = Vendor.query.filter_by(email=email).first()

        if email == '':
            emailErrors = "This field cannot be left blank."
        if password == '':
            passErrors = "This field cannot be left blank."

        if user:
            if not check_pw_hash(password, user.password):
                passErrors = "That password is incorrect."
            else:
                session['email'] = email #starts session
                session['userType'] = "user"
                session['name'] = user.name
                session['userID'] = user.id
                return redirect_dest(fallback=url_for('index'))
        elif vendor:
            if not check_pw_hash(password, vendor.password):
                passErrors = "That password is incorrect."
            else:
                session['email'] = email #starts session
                session['userType'] = "vendor"
                session['name'] = vendor.contactName
                session['userID'] = vendor.id
                return redirect_dest(fallback=url_for('index'))
        else:
            emailErrors = "That user doesn't exist."

        return render_template('login.html', errors=errors, email=email)

    # Adding custom header to response for AJAX requests that don't inherently know how to handle redirects appropriately
    response = make_response(render_template('login.html', errors=errors))
    response.headers['X-Authorization-Required'] = "true"

    return response 

@app.route('/logout')
def logout():
    if not session.get('email'):
        return redirect(session['url'])
    del session['email']
    del session['userType']
    del session['name']
    del session['userID']
    return redirect('/')

@app.route('/')
def index():
    session['url'] = request.path
    return render_template('index.html')

@app.route('/profile', methods=['GET', 'POST'])
def profile():
    if session['userType'] == "user":
        flash("You do not have permission to visit that page.", "is-danger")
        return redirect(session['url'])

    session['url'] = request.path

    vendor = Vendor.query.filter_by(email=session["email"]).first() #get vendor in session

    if request.method == 'POST':
        form = request.form

        name = form['name']
        business_name = form['businessName']
        address = form['streetAddress']
        city = form['city']
        state = form['state']
        zipcode = form['zipcode']

        if name:
            vendor.contactName = name

        if business_name:
            vendor.businessName = business_name

        if address:
            vendor.streetAddress = address

        if city:
            vendor.city = city

        if zipcode:
            vendor.zipcode = zipcode

        db.session.commit()

    if request.args.get("source") == "ajax":
        result = UserVendor.query.join(
            User, 
            UserVendor.user_id == User.id
        ).add_columns(
                UserVendor.id, 
                UserVendor.user_id, 
                UserVendor.vendor_id, 
                UserVendor.bookedDate, 
                UserVendor.eventStartTime, 
                UserVendor.eventEndTime, 
                User.name, 
                User.email
        ).filter(
            UserVendor.vendor_id == vendor.id
        ).order_by(
            UserVendor.bookedDate
        )

        userInfo = []

        for row in result:
            userInfo.append({
                "id": row.id,
                "vendorID": row.vendor_id,
                "userID": row.user_id,
                "bookedDate": row.bookedDate.isoformat(),
                "eventStartTime": row.eventStartTime.isoformat(),
                "eventEndTime": row.eventStartTime.isoformat(),
                "userName": row.name,
                "userEmail": row.email
            })

        return jsonify(userInfo)

    return render_template("vendor-account.html", vendor=vendor, statelist=statelist, typelist=typelist)



@app.route('/cancel/vendor/<int:vendor_id>')
def cancel(vendor_id):
    user = User.query.filter_by(email=session["email"]).first()
    booking = UserVendor.query.filter_by(user_id=user.id, vendor_id=vendor_id).first()
    #booking = UserVendor.query.get(booking_id)

    if booking is not None:
       booking.enabled = False
       db.session.add(booking)
       db.session.commit()

    return redirect("user-account")

@app.route('/user-account', methods=['GET', 'POST'])
def organizer():
    if session['userType'] == "vendor":
        flash("You do not have permission to visit that page.", "is-danger")
        return redirect(session['url'])

    session['url'] = request.path

    user = User.query.filter_by(email=session["email"]).first()

    result = UserVendor.query.join(
        Vendor, 
        UserVendor.vendor_id == Vendor.id
    ).add_columns(
        UserVendor.id,
        UserVendor.user_id,
        UserVendor.vendor_id, 
        UserVendor.bookedDate, 
        UserVendor.eventStartTime, 
        UserVendor.eventEndTime, 
        Vendor.contactName, 
        Vendor.email,
        Vendor.businessName,
        Vendor.rate,
        Vendor.vendorType
    ).filter(
        UserVendor.user_id == user.id, 
        UserVendor.enabled == 1
    ).order_by(
        UserVendor.bookedDate
    )

    venue = []
    photographer = []
    videographer= []
    caterer = []
    music = []
    cosmetics = []
    tailor = []
    greenStatus = "is-selected"

    for row in result:
        if row.vendorType == "venue":
            venue.append(row)
        elif row.vendorType == "photographer":
            photographer.append(row)
        elif row.vendorType == "videographer":
            videographer.append(row)
        elif row.vendorType == "caterer":
            caterer.append(row)
        elif row.vendorType == "music":
            music.append(row)
        elif row.vendorType == "cosmetics":
            cosmetics.append(row)
        elif row.vendorType == "tailor":
            tailor.append(row)

    return render_template("user-account.html", venue=venue,
                                                photographer=photographer,
                                                videographer=videographer,
                                                caterer=caterer,
                                                music=music,
                                                cosmetics=cosmetics,
                                                tailor=tailor,
                                                user=user,
                                                greenStatus=greenStatus)


@app.route('/book', methods=['POST'])
def book():
    if session.get('email') == None or session.get('userType') == "vendor":
        return bad_request("You must be logged in as a user to book a vendor.")

    form = request.form

    vendor = Vendor.query.filter_by(id=form['vendor_id']).first()
    user = User.query.filter_by(email=session['email']).first()

    vendor_id = vendor.id
    user_id = user.id
    eventDate = form.get('book_date')
    eventStartTime = form.get('book_start_time')
    eventEndTime = form.get('book_end_time')
    fullDay = True if form.get('book_full_day') != None else False
    enabled = 1

    error = bad_request("There were some errors while processing your request. Please check your input above.")
    
    try:
        parsedStartTime = datetime.strptime(eventStartTime, '%H:%M:%S')
        parsedEndTime = datetime.strptime(eventEndTime, '%H:%M:%S')
    except ValueError:
        return error

    if any([not eventDate, not eventStartTime, not eventEndTime, parsedStartTime > parsedEndTime]):
        return error
    
    (formattedDate, formattedStartTime, formattedEndTime) = (
        datetime.strptime(eventDate, '%Y-%m-%d').strftime('%B %d, %Y'),
        parsedStartTime.strftime('%I:%M %p'),
        parsedEndTime.strftime('%I:%M %p')
    )

    # Stripping zero-padding from timestamps with hour < 10
    if formattedStartTime[0] == "0":
        formattedStartTime = formattedStartTime[1:]

    if formattedEndTime[0] == "0":
        formattedEndTime = formattedEndTime[1:]

    bookingInfo = {
        'contactName': vendor.contactName,
        'businessName': vendor.businessName,
        'location': "{}, {}".format(vendor.city, vendor.state),
        'fullDay': fullDay,
        'bookDate': formattedDate,
        'bookStartTime': formattedStartTime,
        'bookEndTime': formattedEndTime
    }

    new_Booking = UserVendor(vendor_id, user_id, eventDate, eventStartTime, eventEndTime, fullDay, enabled)
    db.session.add(new_Booking)
    db.session.commit()

    return jsonify(bookingInfo=bookingInfo)

@app.route('/bookexternal/vendortype/<string:vendor_type>')
def bookExternal(vendor_type):
    user = User.query.filter_by(email=session["email"]).first()
    vendor_id = VENDOR_TYPES[vendor_type]
    user_id = user.id
    eventDate = None
    eventStartTime = None
    eventEndTime = None
    enabled = 1

    booking = UserVendor.query.filter_by(user_id=user.id, vendor_id=vendor_id).first()
    if booking is not None:
        booking.enabled = True
        db.session.commit()
    else:
        new_Booking = UserVendor(vendor_id, user_id, eventDate, eventStartTime, eventEndTime, enabled)
        db.session.add(new_Booking)
        db.session.commit()
    return redirect("user-account")

def get_count(q):
    count_q = q.statement.with_only_columns([func.count()]).order_by(None)
    count = q.session.execute(count_q).scalar()
    return count

@app.route('/vendors', methods=['GET', 'POST'])
def vendorList():
    vendor_total = get_count(Vendor.query)

    session['url'] = request.path
    return render_template('vendor-list.html', vendor_total=vendor_total)

# AJAX call to return data from the DB as a json array
@app.route('/getvendors')
def vendor():
    if request.args.get("booked") == "true" and session.get('userType') == "user":
        user = User.query.filter_by(email=session['email']).first()
        bookedVendors = []
        query = UserVendor.query.join(Vendor, UserVendor.vendor_id == Vendor.id).add_columns(Vendor.id).filter(UserVendor.user_id == user.id).order_by(UserVendor.bookedDate)
        for row in query:
            bookedVendors.append(row.id)

        return jsonify(bookedVendors)

    vendor_type = request.args.get("type")

    if vendor_type == "all":
        query = Vendor.query.order_by(Vendor.id.desc())
    else:
        query = Vendor.query.filter_by(vendorType=vendor_type).order_by(Vendor.id.desc())

    vendors = []
    for vendor in query:
        vendors.append({
            "id": vendor.id,
            "businessName": vendor.businessName,
            "contactName": vendor.contactName,
            "email":vendor.email,
            "streetAddress": vendor.streetAddress,
            "city": vendor.city,
            "zipcode": vendor.zipcode,
            "state": vendor.state,
            "rating": vendor.rating,
            "vendorType": vendor.vendorType,
            "rate": vendor.rate,
        })

    return jsonify(type=vendor_type, vendors=vendors)

@app.route('/signup', methods=['GET', 'POST'])
def signup():
    u_errors = {
      'emailErrors': None,
      'passErrors': None,
      'verifyErrors': None,
      'nameErrors': None
    } # initializing user errors object

    v_errors = {
      'emailErrors': None,
      'passErrors': None,
      'verifyErrors': None,
      'nameErrors': None,
      'businessErrors': None,
      'addressErrors': None,
      'cityErrors': None,
      'zipcodeErrors': None,
      'rateErrors': None
    }

    user_info = {}
    vendor_info = {}

    def verifyUserInputs(name, email, password, verify):
        if not name:
            u_errors["nameErrors"] = "This field cannot be left blank."

        # Check if is valid email
        if not re.match(r'(^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$)', email):
            u_errors["emailErrors"] = "That is not a valid email."

        if not re.search(r'(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{8,}', password):
            u_errors["passErrors"] = "Password must be at least 8 characters, and must contain at least one number, uppercase letter and lowercase letter."

        if password != verify:
            u_errors["verifyErrors"] = "Passwords do not match."

    def verifyVendorInputs(name, business_name, email, street_address, city, zipcode, password, verify, rate):
        # Check if is valid email
        if not re.match(r'(^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$)', email):
            v_errors["emailErrors"] = "That is not a valid email."

        if not re.search(r'(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{8,}', password):
            v_errors["passErrors"] = "Password must be at least 8 characters, and must contain at least one number, uppercase letter and lowercase letter."

        if password != verify:
            v_errors["verifyErrors"] = "Passwords do not match."

        if not name:
            v_errors["nameErrors"] = "This field cannot be left blank."

        if not business_name:
            v_errors["businessErrors"] = "This field cannot be left blank."

        if not street_address:
            v_errors["addressErrors"] = "This field cannot be left blank."

        if not re.match(r'\d{5}', zipcode):
            v_errors["zipcodeErrors"] = "Please enter a 5-digit zipcode."

        if not city:
            v_errors["cityErrors"] = "This field cannot be left blank."

        if not rate:
            v_errors["rateErrors"] = "That is not a valid rate."

    if request.method == 'POST': #is user signing up

        form = request.form
        ajax = True if form['ajax'] == 'true' else False
        register_type = request.form['registerType']

        # User signup validation
        if register_type == "user":

            user_info['email'] = email = form['email']
            user_info['name'] = name = form['name']
            password = form['password']
            verify = form['verify']

            verifyUserInputs(
                name,
                email,
                password,
                verify
            )

            if all(u_errors.get(item) == None for item in u_errors):
                user = User.query.filter_by(email=email).first()
                # Check if email already exists
                if not user:
                    # Hash the password before sending to DB
                    new_user = User(name, email, make_pw_hash(password))
                    db.session.add(new_user)
                    db.session.commit()
                    session['email'] = email
                    session['userType'] = "user"
                    session['name'] = new_user.name
                    session['userID'] = new_user.id

                    if ajax:
                        return jsonify(
                            successful=True,
                            email=form['email']
                        )
                else:
                    u_errors["emailErrors"] = "This email is already in use."

        # Vendor signup validation
        elif register_type == "vendor":

            vendor_info['email'] = email = form['email']
            vendor_info['name'] = name = form['name']
            password = form['password']
            verify = form['verify']
            vendor_info['business_name'] = business_name = form['business']
            vendor_info['vendor_type'] = vendor_type = form['vendortype']
            vendor_info['street_address'] = street_address = form['address']
            vendor_info['city'] = city = form['city']
            vendor_info['state'] = state = form['state']
            vendor_info['zipcode'] = zipcode = form['zipcode']
            vendor_info['rate'] = rate = form['rate']

            verifyVendorInputs(
                name,
                business_name,
                email,
                street_address,
                city,
                zipcode,
                password,
                verify,
                rate
            )

            if all(v_errors.get(item) == None for item in v_errors):
                vendor = Vendor.query.filter_by(email=email).first()
                # Check if email already exists
                if not vendor:
                    # Hash the password before sending to DB#
                    new_vendor = Vendor(
                        email,
                        business_name,
                        name,
                        street_address,
                        city,
                        zipcode,
                        None,
                        vendor_type,
                        rate,
                        make_pw_hash(password),
                        state
                    )
                    db.session.add(new_vendor)
                    db.session.commit()
                    session['email'] = email
                    session['userType'] = "vendor"
                    session['name'] = new_vendor.contactName
                    session['userID'] = new_vendor.id

                    if ajax:
                        return jsonify(
                            successful=True,
                            email=form['email']
                        )
                else:
                    v_errors["emailErrors"] = "This email is already in use."

        # If method == post

        if ajax:
            return bad_request("There were errors in your form, stupid.", v_errors)

        return render_template(
            'signup.html',
            u_errors=u_errors,
            v_errors=v_errors,
            user_info=user_info,
            vendor_info=vendor_info,
            type=register_type,
            getrequest=False
        )

    # method == get
    return render_template(
        'signup.html',
        u_errors=u_errors,
        v_errors=v_errors,
        user_info=user_info,
        vendor_info=vendor_info,
        type="user",
        getrequest=True
    )

    #for testing front end of portfolio
@app.route('/portfolio', methods=['GET', 'POST'])
def portfolio():
    vendor_id = request.args.get("vendor")
    vendor = Vendor.query.filter_by(id=vendor_id)

    if not vendor:
        flash("That user no longer exists.", "is-danger")
        return redirect('/')

    return render_template("portfolio.html")

# FOR TESTING PURPOSES ONLY
@app.route('/gendata')
def genData():
    vendorTypes = ['venue', 'photographer', 'videographer', 'caterer', 'music', 'cosmetics', 'tailor']
    fake = Faker()
    for i in range(50):
        user = User(
        fake.name(),
        fake.email(),
        make_pw_hash("Password1")
        )
        vendor = Vendor(
        fake.email(),
        fake.company(),
        fake.name(),
        fake.street_address(),
        fake.city(),
        fake.zipcode(),
        random.randrange(0, 6),
        random.choice(vendorTypes),
        random.randrange(1, 1000),
        make_pw_hash("Password1"),
        fake.state_abbr()
        )
        db.session.add(user)
        db.session.add(vendor)
        
    db.session.commit()
    return redirect('/')



# END TESTING #

if __name__ == '__main__': #run app
    app.run()

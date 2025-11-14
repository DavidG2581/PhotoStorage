# AWS Photo Locker Deployment

Follow the checklist to stand up Cognito, S3, Lambda, and hosting for the static site. Replace placeholder IDs inside `app.js` once resources exist.

## 1. Cognito User Pool
1. Create a User Pool (email as sign-in alias, self sign-up enabled).
2. Enforce password policy: 6-24 chars, require upper, lower, number, and symbol; block duplicate emails.
3. Configure email verification with code delivery.
4. Create an app client for the SPA (no secret). Copy the **User Pool ID** and **App Client ID**.

## 2. Identity & Storage
1. Create or reuse an Identity Pool that allows the web app to access S3 privately. Attach the Cognito User Pool as an authentication provider.
2. Create the S3 bucket `photos` (block public access, enable default encryption).
3. Add an IAM role (the identity pool authenticated role) with the following least-privilege policy:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": ["s3:ListBucket"],
         "Resource": "arn:aws:s3:::photos",
         "Condition": {
           "StringLike": {
             "s3:prefix": ["${cognito-identity.amazonaws.com:sub}/*"]
           }
         }
       },
       {
         "Effect": "Allow",
         "Action": ["s3:GetObject", "s3:PutObject"],
         "Resource": "arn:aws:s3:::photos/${cognito-identity.amazonaws.com:sub}/*"
       }
     ]
   }
   ```
4. Update `app.js` with the Identity Pool region (Amplify Storage inherits the IAM permissions through Cognito auth tokens).

## 3. Lambda Thumbnailer
1. Create a Lambda function triggered by `s3:ObjectCreated:Put` on `photos/*/original/*`.
2. Use Sharp (Node.js) or Pillow (Python) to resize to ~256px width, write to `photos/<sub>/thumbnails/<filename>`.
3. Preserve ACL as private; the web app fetches thumbnails through Amplify Storage using the same credentials.

## 4. Hosting the site
1. Build assets (already plain HTML/CSS/JS in the `PhotoStorage` folder).
2. Upload to S3 static hosting bucket or Amplify Hosting:
   ```bash
   aws s3 sync PhotoStorage s3://your-site-bucket
   ```
3. If using CloudFront, create a distribution pointing to the hosting bucket and add an ACM certificate.
4. Update the placeholders in `app.js` (`YOUR_USER_POOL_ID`, `YOUR_WEB_CLIENT_ID`, `YOUR_BUCKET_REGION`).

## 5. Testing
1. Load the site, sign up with an email, verify via the code.
2. Sign in, upload a photo, confirm the thumbnail appears and opens the original in a new tab.
3. Validate forgot-password flow and sign-out.

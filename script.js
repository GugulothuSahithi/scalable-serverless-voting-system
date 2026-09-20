// ======================================================
// AMAZON COGNITO CONFIGURATION
// ======================================================

const COGNITO_DOMAIN =
    "https://ap-south-1dxesecmb4.auth.ap-south-1.amazoncognito.com";

const CLIENT_ID =
    "703fhkfev307envmdjehv0hob9";

const REDIRECT_URI =
    "http://127.0.0.1:8080/";


// ======================================================
// API GATEWAY
// ======================================================

const API_URL =
    "https://o22l05eusa.execute-api.ap-south-1.amazonaws.com/dev";


// ======================================================
// PKCE FUNCTIONS
// ======================================================

async function sha256(value) {
    const data = new TextEncoder().encode(value);

    return await crypto.subtle.digest(
        "SHA-256",
        data
    );
}


function base64UrlEncode(arrayBuffer) {
    return btoa(
        String.fromCharCode(
            ...new Uint8Array(arrayBuffer)
        )
    )
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
}


function createVerifier() {
    const array = new Uint8Array(32);

    crypto.getRandomValues(array);

    return base64UrlEncode(array);
}


// ======================================================
// LOGIN
// ======================================================

async function login() {

    const verifier = createVerifier();

    sessionStorage.setItem(
        "pkce_verifier",
        verifier
    );

    const challengeBuffer =
        await sha256(verifier);

    const challenge =
        base64UrlEncode(challengeBuffer);

    const loginUrl =
        `${COGNITO_DOMAIN}/oauth2/authorize` +
        `?response_type=code` +
        `&client_id=${encodeURIComponent(CLIENT_ID)}` +
        `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
        `&scope=${encodeURIComponent("openid email")}` +
        `&code_challenge_method=S256` +
        `&code_challenge=${encodeURIComponent(challenge)}`;

    window.location.href = loginUrl;
}


// ======================================================
// HANDLE COGNITO CALLBACK
// ======================================================

async function handleCallback() {

    const params =
        new URLSearchParams(
            window.location.search
        );

    const code = params.get("code");

    // No authorization code means normal page loading
    if (!code) {
        updateAuthUI();
        return;
    }

    const verifier =
        sessionStorage.getItem("pkce_verifier");

    if (!verifier) {

        console.error(
            "PKCE verifier not found."
        );

        return;
    }

    try {

        const response =
            await fetch(
                `${COGNITO_DOMAIN}/oauth2/token`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/x-www-form-urlencoded"
                    },

                    body:
                        new URLSearchParams({
                            grant_type:
                                "authorization_code",

                            client_id:
                                CLIENT_ID,

                            code:
                                code,

                            redirect_uri:
                                REDIRECT_URI,

                            code_verifier:
                                verifier
                        })
                }
            );


        const tokens =
            await response.json();


        if (!response.ok) {

            console.error(
                "Token exchange failed:",
                tokens
            );

            return;
        }


        // Save tokens
        sessionStorage.setItem(
            "access_token",
            tokens.access_token
        );

        sessionStorage.setItem(
            "id_token",
            tokens.id_token
        );


        if (tokens.refresh_token) {
            sessionStorage.setItem(
                "refresh_token",
                tokens.refresh_token
            );
        }


        // Remove temporary PKCE verifier
        sessionStorage.removeItem(
            "pkce_verifier"
        );


        console.log(
            "Cognito login successful"
        );


        // Update website
        updateAuthUI();


        // Remove ?code=... from browser URL
        window.history.replaceState(
            {},
            document.title,
            REDIRECT_URI
        );


    } catch (error) {

        console.error(
            "Cognito login error:",
            error
        );
    }
}


// ======================================================
// UPDATE LOGIN / LOGOUT DISPLAY
// ======================================================

function updateAuthUI() {

    const token =
        sessionStorage.getItem(
            "access_token"
        );


    const status =
        document.getElementById(
            "authStatus"
        );

    const loginButton =
        document.getElementById(
            "loginButton"
        );

    const logoutButton =
        document.getElementById(
            "logoutButton"
        );


    // If the elements don't exist, stop
    if (
        !status ||
        !loginButton ||
        !logoutButton
    ) {
        return;
    }


    if (token) {

        status.textContent =
            "Logged in successfully";

        loginButton.style.display =
            "none";

        logoutButton.style.display =
            "block";

    } else {

        status.textContent =
            "Not logged in";

        loginButton.style.display =
            "block";

        logoutButton.style.display =
            "none";
    }
}


// ======================================================
// LOGOUT
// ======================================================

function logout() {

    // Remove local session
    sessionStorage.clear();


    const logoutUrl =
        `${COGNITO_DOMAIN}/logout` +
        `?client_id=${encodeURIComponent(CLIENT_ID)}` +
        `&logout_uri=${encodeURIComponent(REDIRECT_URI)}`;


    window.location.href =
        logoutUrl;
} 





// ======================================================
// CAST VOTE
// ======================================================

async function castVote() {

    const userId =
        document
            .getElementById("userId")
            .value
            .trim();


    const candidateId =
        document
            .getElementById("candidate")
            .value;


    const message =
        document.getElementById(
            "message"
        );


    // Check voter ID
    if (!userId) {

        message.textContent =
            "Please enter your Voter ID.";

        return;
    }


    // Check candidate
    if (!candidateId) {

        message.textContent =
            "Please select a candidate.";

        return;
    }


    // Check Cognito login
    const token =
        sessionStorage.getItem(
            "access_token"
        );


    if (!token) {

        message.textContent =
            "Please login first.";

        return;
    }


    try {

        const response =
            await fetch(
                `${API_URL}/vote`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json",

                        "Authorization":
                            `Bearer ${token}`
                    },

                    body:
                        JSON.stringify({
                            userId:
                                userId,

                            candidateId:
                                candidateId
                        })
                }
            );


        const data =
            await response.json();


        if (response.ok) {

            message.textContent =
                data.message;


            // Disable vote button after success
            const voteButton =
                document.querySelector(
                    'button[onclick="castVote()"]'
                );

            if (voteButton) {
                voteButton.disabled = true;
                voteButton.textContent =
                    "Vote Submitted";
            }


        } else {

            message.textContent =
                data.message ||
                "Unable to cast vote.";
        }


    } catch (error) {

        console.error(
            "Vote error:",
            error
        );

        message.textContent =
            "Unable to connect to the voting server.";
    }
}


// ======================================================
// GET VOTING RESULTS
// ======================================================

async function getResults() {

    const resultsDiv =
        document.getElementById(
            "results"
        );


    // Check Cognito login
    const token =
        sessionStorage.getItem(
            "access_token"
        );


    if (!token) {

        resultsDiv.textContent =
            "Please login first.";

        return;
    }


    try {

        const response =
            await fetch(
                `${API_URL}/results`,
                {
                    method: "GET",

                    headers: {
                        "Authorization":
                            `Bearer ${token}`
                    }
                }
            );


        const data =
            await response.json();


        if (!response.ok) {

            resultsDiv.textContent =
                "Unable to get results.";

            return;
        }


        resultsDiv.innerHTML = "";


        if (
            !data.results ||
            data.results.length === 0
        ) {

            resultsDiv.textContent =
                "No results available.";

            return;
        }


        data.results.forEach(
            result => {

                const p =
                    document.createElement(
                        "p"
                    );


                p.textContent =
                    `${result.candidateId}: ${result.voteCount} vote(s)`;


                resultsDiv.appendChild(p);
            }
        );


    } catch (error) {

        console.error(
            "Results error:",
            error
        );

        resultsDiv.textContent =
            "Unable to connect to the results server.";
    }
}


// ======================================================
// START APPLICATION
// ======================================================

handleCallback();
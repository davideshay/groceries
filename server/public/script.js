function togglePasswordVisibility(event) {
    let passwordInput = document.getElementById("password");
    if (event.id === "password-verify-visibility") {
        passwordInput = document.getElementById("password-verify");
    }
    if (passwordInput.type === "password") {
        passwordInput.type = "text";
        event.src = "public/icon_visible.svg";
        event.classList.remove("icon-hidden");
    } else {
        passwordInput.type = "password";
        event.src = "public/icon_hidden.svg";
        event.classList.add("icon-hidden");
    }
}
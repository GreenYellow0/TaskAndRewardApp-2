document.getElementById("signupForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const username = document.querySelector("#signupForm input[name='username']").value;
    const password = document.querySelector("#signupForm input[name='password']").value;
    
    fetch("/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    })
    .then((response) => response.json())
    .then((data) => {
      alert(data.message);
    })
    .catch((error) => {
      console.error("Error:", error);
    });
  });
  
  document.getElementById("loginForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const username = document.querySelector("#loginForm input[name='username']").value;
    const password = document.querySelector("#loginForm input[name='password']").value;
    
    fetch("/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    })
    .then((response) => response.json())
    .then((data) => {
      alert(data.message);
    })
    .catch((error) => {
      console.error("Error:", error);
    });
  });
  document.getElementById("signupForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const username = document.querySelector("#signupForm input[name='username']").value;
    const password = document.querySelector("#signupForm input[name='password']").value;
    
    fetch("/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    })
    .then((response) => response.json())
    .then((data) => {
      alert(data.message);
    })
    .catch((error) => {
      console.error("Error:", error);
    });
  });
  
  document.getElementById("loginForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const username = document.querySelector("#loginForm input[name='username']").value;
    const password = document.querySelector("#loginForm input[name='password']").value;
    
    fetch("/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    })
    .then((response) => response.json())
    .then((data) => {
      alert(data.message);
    })
    .catch((error) => {
      console.error("Error:", error);
    });
  });
    
import { useState, useEffect, useLayoutEffect } from 'react';
import LoginPage from '@/pages/LoginPage';
import QueuePage from '@/pages/QueuePage';
import ThemePage from '@/pages/ThemePage';
import { type UserState, type ThemeName, type PracticeState } from '@/types';

//Authenticated Page can either be queue page or themes page, login page is excluded since it is not an authenticated page
type Page = 'queue' | 'themes';

export default function App() {
  //User and practice are null at start
  const [user, setUser] = useState<UserState | null>(null);
  const [practice, setPractice] = useState<PracticeState | null>(null);
  //Loading useState since I am doing a fetch request
  const [loading, setLoading] = useState(true)

  //Function to do a GET request to server to check user's auth status
  const checkAuthStatus = async () => {
    try {
      const response = await fetch('/api/auth/status', {cache: "no-store"})
      if (!response.ok) {
        throw new Error("Not authenticated")
      }
      const data = await response.json()
      //Data also includes UUID, username, and isAdmin to construct user object to later set my user use state as
      const user = {
        id: data.uuid,
        username: data.username,
        isAdmin: data.isAdmin
      }
      setUser(user)
      //Last thing data includes is the practice object to set my practice use state as
      setPractice(data.practice)
    } catch (error) {
      console.log("User is not authenticated")
      setUser(null)
    } finally {
      //Finally block always runs even if an error is caught
      //No longer loading (waiting for fetch request, so can set loading to false)
      setLoading(false)
    }
  }

  //Check auth status upon page load
  useEffect(() => {
    checkAuthStatus()
  }, [])

  //This code is used for when a user logs out in one tab and has another tab with themselves logged in, it will now automatically update and log the user out
  //This works by using local storage by setting the key auth_changed to the current timestamp whenever the user logs in or logs out
  //If that key has changed, it rechecks auth status
  //Uses an event listener for local storage which is registered on page load in this useEffect
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'auth_changed') {
        checkAuthStatus()
      }
    }
    window.addEventListener('storage', handleStorageChange)
    //Return statement for useEffect is for cleaning up by removing event listener when React app is unmounted
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [])

  //Path is used for displaying page not found page when user tries to navigate to a non-valid path (any path not /)
  const path = window.location.pathname
  const isValidPath = path === "/"

  //Use state for which authenticated page is being displayed to the user
  //Since this is a single page app with only ~3 pages I am not using React router and just using a useState to toggle between what content is displayed
  const [authenticatedPage, setAuthenticatedPage] = useState<Page>('queue');
  //Theme useState, defaults to Forest theme
  const [theme, setTheme] = useState<ThemeName>('forest');

  //UseLayoutEffect is used for toggling the theme, whenever theme use state changes it updates by setting the attribute to be a different theme
  //In index.css it is using an attribute selector (square brackets) based on the value of the data-theme attribute
  useLayoutEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  //Callback function for when user logs presses the log in button on the log in page
  function handleEnter(u: UserState, p: PracticeState) {
    //Update localStorage, so multiple tabs within same browser (have the same cookie) will get updated from log in screen to queue page
    localStorage.setItem('auth_changed', Date.now().toString());
    //Set user and practice to arguments of callback function, will get passed to queue page
    setUser(u);
    setPractice(p);
    //Set page to queue since user has now logged in
    setAuthenticatedPage('queue');
  }

  //Callback function for when user clicks logout button on queue page
  async function handleLogout() {
    //Back to null for user and practice since on login page
    setUser(null);
    setPractice(null);
    //Changes session cookie on server by doing this POST request
    try {
      await fetch("/api/logout", {method: "POST"})
    } catch (error) {
      console.log("Error logging user out")
    }
    //Same concept as above, change local storage value to current timestamp and listener will cause checkAuthStatus to be called
    //Note it is important this happens after the POST request to prevent a race condition
    localStorage.setItem('auth_changed', Date.now().toString());
  }

  //Logic for conditional rendering now

  //If not URL is not a valid path, render the page does not exist page
  if (!isValidPath) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--th-login-gradient)' }} >
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-white/20 backdrop-blur-sm mb-5 shadow-xl overflow-hidden">
              <img
                src="/pickleball-bat-and-ball-free-vector.jpg"
                alt="Pickleball"
                className="w-full h-full object-cover"
              />
            </div>
            <h1 className="text-4xl font-extrabold text-white tracking-tight drop-shadow mb-6">
              This page does not exist!
            </h1>
            <a href="/" className="text-white/80 hover:text-white bg-white/15 hover:bg-white/25 w-full p-3.5 rounded-xl text-base font-bold shadow-lg transition-colors">
            Click here to return home
            </a>
          </div>
        </div> 
      </div>
    )
  }

  if (loading) {
    return (
      <p>Loading...</p>
    )
  }
  else {
    if (user !== null) {
      if (authenticatedPage === 'themes') {
        return (
          <ThemePage 
          current={theme} 
          onSelect={(t) => {setTheme(t); setAuthenticatedPage('queue');}} 
          onBack={() => setAuthenticatedPage('queue')} />
        )
      } else if (authenticatedPage === 'queue') {
        return (
          <QueuePage
          user={user}
          practice={practice}
          onLogout={handleLogout}
          onOpenThemes={() => setAuthenticatedPage('themes')}
          />
        )
      }
    } else {
      return <LoginPage onEnter={handleEnter} />
    }
  }
}
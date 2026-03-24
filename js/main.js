/**
 * ============================================================================
 * MAIN JAVASCRIPT LOGIC
 * ============================================================================
 * Handles all the interactive elements of the site: 
 * navbar effects, scroll animations, and the showcase tabs.
 */

document.addEventListener('DOMContentLoaded', () => {
    /* 
     * 1. NAVIGATION SCROLL EFFECT
     * When the user scrolls down more than 50 pixels, the navbar gets the 'scrolled'
     * class, which makes it slightly darker and smaller (see animations.css).
     */
    const navbar = document.getElementById('navbar');

    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    });

    /* 
     * 2. INTERSECTION OBSERVER FOR SCROLL ANIMATIONS
     * This API efficiently watches elements and triggers code when they appear on screen.
     * Here, it waits until 15% (threshold: 0.15) of a section is visible before fading it in.
     */
    const observerOptions = {
        root: null,
        rootMargin: '0px 0px -50px 0px', // Trigger reveal when content is 50px into the viewport
        threshold: 0.01
    };

    const sectionObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                // When we scroll past a section, give it the 'is-visible' class
                entry.target.classList.add('is-visible');
                // Stop observing it so it stays visible even if we scroll up and down
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    // Grab all sections/elements we want to animate on scroll (Showcase and CV sections)
    // This observer looks for sections with class .showcase-section, .cv-section, or .thoughts-section
    const revealSections = document.querySelectorAll('.showcase-section, .cv-section, .thoughts-section');
    revealSections.forEach(section => {
        section.classList.add('fade-in-section'); // Ensures they start invisible
        sectionObserver.observe(section);
    });

    /* 
     * 3. SMOOTH SCROLLING FOR ANCHOR LINKS
     * Because the Navbar is fixed to the top of the screen (z-index 1000), clicking
     * a link to #cv would normally scroll the title *underneath* the navbar.
     * This code calculates the height of the navbar and offsets the scroll so it stops in the right place.
     */
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault(); // Stop normal jumping behavior
            const targetId = this.getAttribute('href');
            if (targetId === '#') return;

            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                const navHeight = navbar.offsetHeight;
                const elementPosition = targetElement.getBoundingClientRect().top;
                const offsetPosition = elementPosition + window.pageYOffset - navHeight;

                window.scrollTo({
                    top: offsetPosition,
                    behavior: 'smooth' // Glide down the page smoothly
                });
            }
        });
    });

    /* 
     * 4. TAB SWITCHING LOGIC FOR SHOWCASE
     * Controls the Buttons (Books, Films, etc)
     */
    const tabBtns = document.querySelectorAll('.tab-btn');
    const gridContainers = document.querySelectorAll('.grid-container');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-target');

            // Update URL hash without jumping the page
            if (history.pushState) {
                history.pushState(null, null, '#' + targetId);
            } else {
                window.location.hash = targetId;
            }

            // Step 1: Remove 'active' class from ALL buttons and grids (hide everything)
            tabBtns.forEach(b => b.classList.remove('active'));
            gridContainers.forEach(g => g.classList.remove('active'));

            // Step 2: Add 'active' class only to the clicked button (makes it highlighted)
            btn.classList.add('active');

            // Step 3: Find the grid whose ID matches the button's data-target...
            // ...and make it visible
            const targetGrid = document.getElementById(targetId);
            if (targetGrid) targetGrid.classList.add('active');
        });
    });

    // --- Tab Persistence: Check hash on load ---
    const initialHash = window.location.hash.substring(1); // remove the '#'
    if (initialHash) {
        const targetBtn = Array.from(tabBtns).find(btn => btn.getAttribute('data-target') === initialHash);
        if (targetBtn) {
            targetBtn.click();
        }
    }

    /* 
     * 5. EXTERNAL MEDIA FETCHING (Goodreads & Letterboxd)
     * Uses api.rss2json.com to bypass CORS and parse RSS feeds into JSON.
     */
    const GOODREADS_RSS_URL = 'https://www.goodreads.com/review/list_rss/134531861-tun?shelf=currently-reading';
    const LETTERBOXD_RSS_URL = 'https://letterboxd.com/ohulelo/rss/';

    async function fetchMediaFeeds() {
        // Helper function to fetch and parse RSS using rss2json
        async function fetchRSS(feedUrl) {
            if (!feedUrl || feedUrl.includes('YOUR_')) return [];
            try {
                // Add a random cache-busting string to the RSS URL to bypass rss2json caching
                const cacheBuster = `&t=${new Date().getTime()}`;
                const feedUrlWithCacheBust = feedUrl.includes('?') ? feedUrl + cacheBuster : feedUrl + '?' + cacheBuster.substring(1);

                const response = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feedUrlWithCacheBust)}`);
                const data = await response.json();
                return data.items || [];
            } catch (error) {
                console.error("Error fetching RSS:", error);
                return [];
            }
        }

        // --- Fetch Books ---
        const booksContainer = document.getElementById('books');
        if (booksContainer && !GOODREADS_RSS_URL.includes('YOUR_')) {
            const books = await fetchRSS(GOODREADS_RSS_URL);
            if (books && books.length > 0) {
                // Add the divider for the dynamic section
                booksContainer.innerHTML += `
                    <div class="section-header" style="grid-column: 1 / -1; margin-top: var(--space-xl); margin-bottom: 0; text-align: left;">
                        <h3 style="font-size: 1.2rem; color: var(--color-text-muted); border-bottom: 1px solid var(--color-accent-dim); padding-bottom: 0.5rem; margin-bottom: 1rem;">currently reading.</h3>
                    </div>
                `;

                // Extract the numerical rating from the description HTML (e.g. "rating: 5<br>")
                const getBookRating = (description) => {
                    const match = description.match(/rating: (\d+)/);
                    return match ? parseInt(match[1]) : 0;
                };

                // Sort books by highest rating (optional)
                // books.sort((a, b) => getBookRating(b.description) - getBookRating(a.description));

                // Render up to 5 books
                books.slice(0, 5).forEach(book => {
                    const desc = book.description;

                    const imgMatch = desc.match(/src="([^"]+)"/);
                    let coverUrl = imgMatch ? imgMatch[1] : '';
                    coverUrl = coverUrl.replace(/\._S[XY]\d+_/g, '');

                    // Extract author from description: 
                    // Pattern 1: by <a href="...">Author Name</a>
                    // Pattern 2: author: Author Name<br>
                    let author = book.author;
                    if (!author || author === 'Goodreads') {
                        const authorLinkMatch = desc.match(/by <a.*?>([^<]+)<\/a>/);
                        const authorTextMatch = desc.match(/author:\s*([^<]+)<br/i);

                        if (authorLinkMatch) {
                            author = authorLinkMatch[1].trim();
                        } else if (authorTextMatch) {
                            author = authorTextMatch[1].trim();
                        } else {
                            author = 'Goodreads';
                        }
                    }

                    const html = `
                        <a href="${book.link}" target="_blank" class="grid-item hover-shine">
                            <div class="item-visual book-cover" style="background-image: url('${coverUrl}'); background-size: cover; background-position: center; border-radius: 8px;"></div>
                            <div class="item-meta">
                                <h3>${book.title}</h3>
                                <p>${author}</p>
                            </div>
                        </a>
                    `;
                    booksContainer.innerHTML += html;
                });
            }
        }

        // --- Fetch Films ---
        // --- Render "Recently Watched" from local data ---
        const filmsContainer = document.getElementById('films');
        if (filmsContainer && typeof latestFilms !== 'undefined') {
            // Add the divider for the local sync section
            filmsContainer.innerHTML += `
                        <div class="section-header"
                            style="grid-column: 1 / -1; margin-top: var(--space-xl); display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--color-accent-dim); padding-bottom: 0.5rem; margin-bottom: 1rem;">
                            <h3 style="font-size: 1.2rem; color: var(--color-text-muted); margin: 0;">
                                recently watched.
                            </h3><a href="https://boxd.it/1e3DD" target="_blank"
                                style="font-size: 0.85rem; color: var(--color-text-main); text-decoration: none; border: 1px solid var(--color-text-muted); padding: 4px 12px; border-radius: 20px; transition: all 0.2s ease;"
                                onmouseover="this.style.backgroundColor='var(--color-text-main)'; this.style.color='var(--color-bg)';"
                                onmouseout="this.style.backgroundColor='transparent'; this.style.color='var(--color-text-main)';">
                                see more on letterboxd ↗
                            </a>
                </div>
            `;

            latestFilms.forEach(film => {
                filmsContainer.innerHTML += `
                    <a href="${film.link}" target="_blank" class="grid-item hover-shine">
                        <div class="item-visual film-still" 
                             style="background-image: url('${film.posterUrl}'); background-size: cover; background-position: center; border-radius: 8px;">
                        </div>
                        <div class="item-meta">
                            <h3>${film.title}.</h3>
                            <p style="text-align: left;">${film.director} (${film.year}) — ${film.rating}</p>
                        </div>
                    </a>
                `;
            });
        }
    }

    // --- Initialize Essay Summaries (Smart Browser)     // --- Initialize Thoughts Feed (Data-Driven) ---
    function renderThoughts() {
        const feedContainer = document.getElementById('thoughts-feed');
        if (!feedContainer || typeof latestThoughts === 'undefined') return;
        feedContainer.innerHTML = ''; // Clear placeholder

        latestThoughts.forEach(thought => {
            const html = `
                <a href="${thought.link}" class="thought-card fade-in-section"
                    style="background: var(--color-bg-alt); padding: var(--space-lg) var(--space-md); border-radius: 12px; border: 1px solid var(--glass-border); box-shadow: 0 4px 20px rgba(0,0,0,0.05); text-decoration: none; display: block; transition: all 0.4s ease;">

                    <div style="font-size: 0.85rem; color: var(--color-text-muted); margin-bottom: var(--space-xs); font-family: var(--font-primary);">
                        ${thought.date}
                    </div>

                    <h3 class="thought-title"
                        style="font-family: var(--font-primary); font-size: 1.5rem; margin-bottom: var(--space-md); color: var(--color-text-main);">
                        ${thought.title.toLowerCase()}${thought.title.endsWith('.') ? '' : '.'}
                    </h3>

                    <div style="font-family: var(--font-secondary); font-size: 1.15rem; line-height: 1.8; color: var(--color-text-main);">
                        <p class="preview-text">${thought.summary}</p>
                    </div>

                    <div style="margin-top: var(--space-md); color: var(--color-accent); font-weight: 500; font-size: 0.95rem;">
                        read essay →
                    </div>
                </a>
            `;
            feedContainer.innerHTML += html;
        });

        // Re-run the intersection observer to pick up the new cards
        const newCards = feedContainer.querySelectorAll('.thought-card');
        if (typeof sectionObserver !== 'undefined') {
            newCards.forEach(card => sectionObserver.observe(card));
        }
    }

    // Determine if we are on the intro/home page
    const isHomePage = window.location.pathname.endsWith('index.html') ||
        window.location.pathname.endsWith('/') ||
        window.location.pathname === '';

    // Initialize appropriate features
    if (!isHomePage) {
        fetchMediaFeeds();
        renderThoughts();
    }

    /* 
     * 6. PLAYLIST ACCORDION LOGIC
     */
    const categoryWrappers = document.querySelectorAll('.playlist-category-wrapper');
    if (categoryWrappers.length > 0) {
        // Inject animation styles dynamically
        const style = document.createElement('style');
        style.innerHTML = `
            .music-grid {
                gap: 0 !important;
            }
            .playlist-category-wrapper {
                cursor: pointer;
                position: relative;
                transition: opacity 0.2s ease, transform 0.2s ease;
                margin-top: var(--space-lg) !important;
                margin-bottom: var(--space-sm) !important;
            }
            .playlist-category-wrapper:hover {
                opacity: 0.8;
                transform: scale(0.99);
            }
            .accordion-arrow {
                display: inline-block;
                transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
                font-size: 1.2rem;
                margin-left: 12px;
                opacity: 0.6;
                vertical-align: middle;
            }
            .playlist-row {
                overflow: hidden;
                transition: max-height 0.6s cubic-bezier(0.4, 0, 0.2, 1), 
                            opacity 0.4s cubic-bezier(0.4, 0, 0.2, 1), 
                            margin 0.6s cubic-bezier(0.4, 0, 0.2, 1),
                            padding 0.6s cubic-bezier(0.4, 0, 0.2, 1);
                max-height: 0;
                opacity: 0;
                margin-top: 0 !important;
                margin-bottom: 0 !important;
                padding-top: 0 !important;
                padding-bottom: 0 !important;
            }
            .playlist-row.open {
                max-height: 2500px; /* large enough to fit 3 iframes vertically on mobile */
                opacity: 1;
                margin-top: var(--space-md) !important;
                margin-bottom: var(--space-xl) !important;
                padding-bottom: 10px !important;
            }
        `;
        document.head.appendChild(style);

        categoryWrappers.forEach((wrapper, index) => {
            const titleDiv = wrapper.querySelector('.playlist-category');
            if (titleDiv) {
                // Add the arrow span
                titleDiv.innerHTML += '<span class="accordion-arrow">▼</span>';
            }

            let row = wrapper.nextElementSibling;
            // Find the closest playlist-row in case of varying HTML structure
            while(row && !row.classList.contains('playlist-row')) {
                row = row.nextElementSibling;
            }

            if (row) {
                // Handle click to open/close
                wrapper.addEventListener('click', () => {
                    const isOpen = row.classList.contains('open');
                    const arrow = wrapper.querySelector('.accordion-arrow');
                    
                    if (isOpen) {
                        row.classList.remove('open');
                        if (arrow) arrow.style.transform = 'rotate(0deg)';
                    } else {
                        row.classList.add('open');
                        if (arrow) arrow.style.transform = 'rotate(180deg)';
                    }
                });
            }
        });
    }
});

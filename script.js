/* =============================================
   SIX FEET UNDER - JavaScript
   ============================================= */

document.addEventListener('DOMContentLoaded', () => {

  // ---------- Particle System ----------
  const particlesContainer = document.getElementById('particles');
  const particleCount = 30;

  for (let i = 0; i < particleCount; i++) {
    const particle = document.createElement('div');
    particle.classList.add('particle');
    particle.style.left = Math.random() * 100 + '%';
    particle.style.animationDelay = Math.random() * 8 + 's';
    particle.style.animationDuration = (6 + Math.random() * 6) + 's';
    particlesContainer.appendChild(particle);
  }

  // ---------- Navigation Scroll Effect ----------
  const nav = document.getElementById('nav');

  window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
      nav.classList.add('scrolled');
    } else {
      nav.classList.remove('scrolled');
    }
  });

  // ---------- Mobile Navigation Toggle ----------
  const navToggle = document.getElementById('navToggle');
  const navLinks = document.getElementById('navLinks');

  navToggle.addEventListener('click', () => {
    navLinks.classList.toggle('open');
  });

  // Close mobile nav when clicking a link
  navLinks.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      navLinks.classList.remove('open');
    });
  });

  // ---------- Scroll Reveal Animations ----------
  const revealElements = document.querySelectorAll(
    '.about-card, .rules-scroll, .member-card, .gallery-placeholder, .join-requirements, .join-form-wrapper'
  );

  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry, index) => {
      if (entry.isIntersecting) {
        // Stagger the animation for grid items
        const delay = entry.target.dataset.delay || 0;
        setTimeout(() => {
          entry.target.classList.add('visible');
        }, delay);
        revealObserver.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
  });

  revealElements.forEach((el, index) => {
    // Assign stagger delay based on sibling position
    const parent = el.parentElement;
    const siblings = Array.from(parent.children).filter(child =>
      child.classList.contains(el.classList[0])
    );
    const siblingIndex = siblings.indexOf(el);
    el.dataset.delay = siblingIndex * 100;

    revealObserver.observe(el);
  });

  // ---------- Active Navigation Highlighting ----------
  const sections = document.querySelectorAll('.section, .hero');
  const navItems = document.querySelectorAll('.nav-links a');

  const sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.getAttribute('id');
        navItems.forEach(item => {
          item.classList.remove('active');
          if (item.getAttribute('href') === '#' + id) {
            item.classList.add('active');
          }
        });
      }
    });
  }, {
    threshold: 0.3
  });

  sections.forEach(section => {
    sectionObserver.observe(section);
  });

  // ---------- Form Handling ----------
  const joinForm = document.getElementById('joinForm');

  joinForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const formData = new FormData(joinForm);
    const data = Object.fromEntries(formData.entries());

    // Show a themed confirmation
    const wrapper = document.querySelector('.join-form-wrapper');
    wrapper.innerHTML = `
      <div style="text-align: center; padding: 3rem 1rem;">
        <div style="font-size: 3rem; margin-bottom: 1rem;">&#9876;</div>
        <h3 style="font-family: 'Cinzel', serif; color: #c9a84c; letter-spacing: 2px; margin-bottom: 1rem;">
          Bewerbung erhalten!
        </h3>
        <p style="color: #8a8578; font-size: 1.05rem; line-height: 1.8;">
          Willkommen in der Dunkelheit, <strong style="color: #d4cfc4;">${data.charName}</strong>.<br>
          Wir werden deine Bewerbung prufen und dich uber Discord kontaktieren.
        </p>
        <p style="color: #5a5650; margin-top: 1.5rem; font-style: italic;">
          Die Schatten werden dich finden...
        </p>
      </div>
    `;
  });

  // ---------- Load All Members from members.json ----------
  async function loadAllMembers() {
    const grid = document.getElementById('rosterGrid');
    const updatedEl = document.getElementById('rosterUpdated');
    const noteEl = document.getElementById('rosterNote');

    try {
      const response = await fetch('members.json');
      if (!response.ok) throw new Error('Fetch failed');
      const data = await response.json();

      updatedEl.textContent = `Aktualisiert: ${data.updated_at}`;

      if (!data.members || data.members.length === 0) {
        grid.innerHTML = `
          <div class="roster-empty">
            <p>Noch keine Mitglieder synchronisiert.</p>
            <p class="roster-empty-hint">Der GitHub Action Workflow muss einmal ausgefuehrt werden.</p>
          </div>
        `;
        noteEl.textContent = 'Richte den Discord Bot ein, um die Mitglieder automatisch zu laden.';
        return;
      }

      noteEl.textContent = `${data.member_count} Krieger im Tribe`;

      grid.innerHTML = data.members.map(member => {
        const rankClass = getRankClass(member.rank);
        const avatarHtml = member.avatar
          ? `<img src="${member.avatar}" alt="${member.name}" class="roster-avatar-img">`
          : `<span class="roster-avatar-fallback">&#9876;</span>`;

        return `
          <div class="member-card ${rankClass}">
            <div class="member-rank">${member.rank}</div>
            <div class="member-avatar-wrap">${avatarHtml}</div>
            <div class="member-name">${member.name}</div>
            <div class="member-class">@${member.username}</div>
          </div>
        `;
      }).join('');

      // Re-apply scroll animations to new cards
      document.querySelectorAll('#rosterGrid .member-card').forEach((el, i) => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(30px)';
        setTimeout(() => {
          el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
          el.style.opacity = '1';
          el.style.transform = 'translateY(0)';
        }, i * 80);
      });

    } catch (err) {
      grid.innerHTML = `
        <div class="roster-empty">
          <p>Mitgliederliste konnte nicht geladen werden.</p>
        </div>
      `;
      noteEl.textContent = 'members.json nicht gefunden oder fehlerhaft.';
    }
  }

  function getRankClass(rank) {
    const r = rank.toLowerCase();
    if (r === 'tyrant') return 'rank-leader';
    if (r === 'officer') return 'rank-officer';
    if (r === 'tribe') return 'rank-tribe';
    if (r === 'ally') return 'rank-ally';
    if (r === 'guest') return 'rank-guest';
    return 'rank-member';
  }

  loadAllMembers();

  // ---------- Discord Widget Integration ----------
  // WICHTIG: Ersetze diese ID mit deiner Discord Server-ID!
  // Findest du unter: Server-Einstellungen → Widget → Server-ID
  const DISCORD_GUILD_ID = '531795681623670785';

  async function loadDiscordMembers() {
    const membersContainer = document.getElementById('discordMembers');
    const loadingEl = document.getElementById('discordLoading');
    const errorEl = document.getElementById('discordError');
    const countEl = document.getElementById('discordMemberCount');
    const inviteLink = document.getElementById('discordInvite');

    // Skip if no real server ID configured
    if (DISCORD_GUILD_ID === 'DEINE_SERVER_ID_HIER') {
      loadingEl.style.display = 'none';
      errorEl.style.display = 'block';
      errorEl.querySelector('p').textContent = '⚙ Server-ID noch nicht konfiguriert.';
      errorEl.querySelector('.discord-error-hint').innerHTML =
        'Trage deine Discord Server-ID in <code>script.js</code> ein:<br>' +
        '<code>const DISCORD_GUILD_ID = \'123456789\';</code>';
      return;
    }

    try {
      const response = await fetch(
        `https://discord.com/api/guilds/${DISCORD_GUILD_ID}/widget.json`
      );

      if (!response.ok) {
        throw new Error('Widget nicht verfügbar');
      }

      const data = await response.json();

      loadingEl.style.display = 'none';

      // Set invite link
      if (data.instant_invite) {
        inviteLink.href = data.instant_invite;
        inviteLink.style.display = 'flex';
      }

      // Member count
      const onlineCount = data.members ? data.members.length : 0;
      countEl.textContent = `${onlineCount} Online`;
      countEl.classList.add('online');

      if (!data.members || data.members.length === 0) {
        membersContainer.innerHTML =
          '<p class="discord-empty">Keine Krieger sind derzeit online...</p>';
        return;
      }

      // Sort: prioritize members with special status
      const sortedMembers = data.members.sort((a, b) => {
        const statusOrder = { online: 0, idle: 1, dnd: 2 };
        return (statusOrder[a.status] || 3) - (statusOrder[b.status] || 3);
      });

      membersContainer.innerHTML = sortedMembers.map(member => {
        const statusClass = `status-${member.status || 'offline'}`;
        const statusLabel = {
          online: 'Online',
          idle: 'Abwesend',
          dnd: 'Nicht stören'
        }[member.status] || 'Offline';

        const avatarHtml = member.avatar_url
          ? `<img src="${member.avatar_url}" alt="${member.username}" class="discord-avatar-img">`
          : `<span class="discord-avatar-fallback">&#9876;</span>`;

        const gameHtml = member.game
          ? `<span class="discord-game" title="${member.game.name}">&#9654; ${member.game.name}</span>`
          : '';

        return `
          <div class="discord-member">
            <div class="discord-avatar ${statusClass}">
              ${avatarHtml}
              <span class="discord-status-dot ${statusClass}" title="${statusLabel}"></span>
            </div>
            <div class="discord-member-info">
              <span class="discord-username">${member.username}</span>
              ${gameHtml}
            </div>
          </div>
        `;
      }).join('');

    } catch (err) {
      loadingEl.style.display = 'none';
      errorEl.style.display = 'block';
    }
  }

  loadDiscordMembers();

  // Refresh Discord members every 60 seconds
  setInterval(loadDiscordMembers, 60000);

  // ---------- Smooth scroll for Safari ----------
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        target.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });

});

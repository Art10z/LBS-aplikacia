/**
 * Modul pre synchronizáciu sekcií v dynamickom plátne
 */

export class SectionSync {
  constructor() {
    this.syncGroups = new Map(); // Map<sectionType, { master: sectionId, slaves: Set<sectionId> }>
  }

  /**
   * Nastaví sekciu ako master pre synchronizáciu
   */
  setMaster(sectionId, sectionType) {
    if (!this.syncGroups.has(sectionType)) {
      this.syncGroups.set(sectionType, { master: null, slaves: new Set() });
    }
    
    const group = this.syncGroups.get(sectionType);
    
    // Ak už existuje master, presunieme ho do slaves
    if (group.master && group.master !== sectionId) {
      group.slaves.add(group.master);
    }
    
    // Nastavíme nový master
    group.master = sectionId;
    group.slaves.delete(sectionId); // Master nemôže byť slave
    
    return group;
  }

  /**
   * Odstráni sekciu zo synchronizácie
   */
  removeFromSync(sectionId, sectionType) {
    const group = this.syncGroups.get(sectionType);
    if (!group) return;

    if (group.master === sectionId) {
      // Ak bol master, zvolíme nový master zo slaves
      const newMaster = Array.from(group.slaves)[0];
      group.master = newMaster || null;
      if (newMaster) group.slaves.delete(newMaster);
    } else {
      group.slaves.delete(sectionId);
    }

    // Ak nie sú žiadne sekcie, odstránime celú skupinu
    if (!group.master && group.slaves.size === 0) {
      this.syncGroups.delete(sectionType);
    }
  }

  /**
   * Zistí, či je sekcia master
   */
  isMaster(sectionId, sectionType) {
    const group = this.syncGroups.get(sectionType);
    return group?.master === sectionId;
  }

  /**
   * Zistí, či je sekcia slave
   */
  isSlave(sectionId, sectionType) {
    const group = this.syncGroups.get(sectionType);
    return group?.slaves.has(sectionId);
  }

  /**
   * Získa všetky slave sekcie pre danú master sekciu
   */
  getSlaves(sectionType) {
    const group = this.syncGroups.get(sectionType);
    return group ? Array.from(group.slaves) : [];
  }

  /**
   * Získa master ID pre danú sekciu
   */
  getMaster(sectionType) {
    const group = this.syncGroups.get(sectionType);
    return group?.master || null;
  }

  /**
   * Získa informácie o sync group
   */
  getSyncInfo(sectionType) {
    const group = this.syncGroups.get(sectionType);
    if (!group) return null;
    
    return {
      master: group.master,
      slaves: Array.from(group.slaves),
      count: (group.master ? 1 : 0) + group.slaves.size
    };
  }

  /**
   * Exportuje stav synchronizácie
   */
  export() {
    const exported = {};
    this.syncGroups.forEach((group, type) => {
      exported[type] = {
        master: group.master,
        slaves: Array.from(group.slaves)
      };
    });
    return exported;
  }

  /**
   * Importuje stav synchronizácie
   */
  import(data) {
    this.syncGroups.clear();
    Object.entries(data || {}).forEach(([type, group]) => {
      this.syncGroups.set(type, {
        master: group.master,
        slaves: new Set(group.slaves)
      });
    });
  }
}

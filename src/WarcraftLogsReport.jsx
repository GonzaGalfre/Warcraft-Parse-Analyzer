import React, { useState, useEffect } from 'react';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription 
} from './components/ui/card';
import { Input } from './components/ui/input';
import { Button } from './components/ui/button';
import { 
  Table, 
  TableBody, 
  TableCaption, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from './components/ui/table';
import { Alert, AlertDescription, AlertTitle } from './components/ui/alert';
import { Badge } from './components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
import { Separator } from './components/ui/separator';
import { Skeleton } from './components/ui/skeleton';

const WarcraftLogsReport = () => {
  const [reportCode, setReportCode] = useState('');
  const apiKey = '122f2d0f15365c7c36b5b04fe99800e7';
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [players, setPlayers] = useState([]);
  const [fightParses, setFightParses] = useState({});
  const [selectedFight, setSelectedFight] = useState(null);
  const [reportTitle, setReportTitle] = useState('');
  const [targetZone, setTargetZone] = useState('Liberation of Undermine');

  const fetchReport = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Fetch report data
      const reportUrl = `https://www.warcraftlogs.com/v1/report/fights/${reportCode}?api_key=${apiKey}`;
      const reportResponse = await fetch(reportUrl);
      
      if (!reportResponse.ok) {
        throw new Error(`HTTP error while fetching report: ${reportResponse.status}`);
      }
      
      const reportJson = await reportResponse.json();
      setReportTitle(reportJson.title || 'Warcraft Logs Report');
      
      // Filter fights to only include those from the target zone
      const raidFights = reportJson.fights.filter(fight => 
        fight.zoneName === targetZone && fight.boss !== 0
      );
      
      // Get players from exported characters with additional class information
      const exportedPlayers = reportJson.exportedCharacters || [];
      
      if (exportedPlayers.length === 0) {
        throw new Error("No players found in exportedCharacters.");
      }
      
      // Enhance player data with class information from friendlies if available
      const enhancedPlayers = exportedPlayers.map(player => {
        const friendly = (reportJson.friendlies || []).find(f => 
          f.name === player.name && f.server === player.server
        );
        
        return {
          ...player,
          class: friendly?.type || null,
          spec: friendly?.icon?.split('-')[1] || null
        };
      });
      
      setPlayers(enhancedPlayers);
      
      // Fetch parses for all players
      const fetchParsesForPlayer = async (player) => {
        const { name, server, region } = player;
        const url = `https://www.warcraftlogs.com/v1/parses/character/${name}/${server}/${region}?api_key=${apiKey}`;
        const res = await fetch(url);
        
        if (!res.ok) {
          throw new Error(`HTTP error for ${name}: ${res.status}`);
        }
        
        const data = await res.json();
        return data.map(parse => ({ ...parse, playerName: name }));
      };
      
      const allPlayersParsesArrays = await Promise.all(enhancedPlayers.map(fetchParsesForPlayer));
      const allParses = allPlayersParsesArrays.flat();
      
      // Group parses by fight
      const fightPlayerParses = {};
      (reportJson.fights || []).forEach(fight => {
        if (fight.boss && fight.boss !== 0 && fight.zoneName === targetZone) {
          const fightId = fight.id;
          const matchingParses = allParses.filter(parse =>
            parse.reportID === reportCode && parse.fightID === fightId
          );
          
          const playerParseObjects = matchingParses.map(parse => ({
            playerName: parse.playerName,
            percentile: Math.floor(parse.percentile || 0),
            spec: parse.spec,
            class: parse.class
          }));
          
          playerParseObjects.sort((a, b) => b.percentile - a.percentile);
          fightPlayerParses[fight.name || `Fight ${fightId}`] = {
            parses: playerParseObjects,
            fightId: fightId,
            fightDetails: fight
          };
        }
      });
      
      setFightParses(fightPlayerParses);
      
      // Set the first fight as selected by default if there are fights
      const fightNames = Object.keys(fightPlayerParses);
      if (fightNames.length > 0) {
        setSelectedFight(fightNames[0]);
      }
      
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Get class color
  const getClassColor = (className) => {
    const classColors = {
      'DeathKnight': '#C41E3A',
      'DemonHunter': '#A330C9',
      'Druid': '#FF7C0A',
      'Hunter': '#AAD372',
      'Mage': '#3FC7EB',
      'Monk': '#00FF98',
      'Paladin': '#F48CBA',
      'Priest': '#FFFFFF',
      'Rogue': '#FFF468',
      'Shaman': '#0070DD',
      'Warlock': '#8788EE',
      'Warrior': '#C69B6D',
      'Evoker': '#33937F',
      'NPC': '#999999',
      'Pet': '#999999'
    };
    
    return classColors[className] || '#888888';
  };

  // Get percentile badge variant
  const getPercentileBadgeVariant = (percentile) => {
    if (percentile >= 95) return 'destructive'; // Legendary
    if (percentile >= 75) return 'outline';     // Epic
    if (percentile >= 50) return 'secondary';   // Rare
    if (percentile >= 25) return 'default';     // Uncommon
    return 'secondary';                         // Common
  };

  // Format time in seconds to MM:SS
  const formatTime = (timeInMs) => {
    if (!timeInMs || isNaN(timeInMs)) return '00:00';
    
    const seconds = Math.floor(timeInMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Calculate player averages across all fights
  const calculatePlayerAverages = () => {
    if (Object.keys(fightParses).length === 0) return [];
    
    // Collect all parse entries for each player
    const playerParses = {};
    
    Object.values(fightParses).forEach(fight => {
      fight.parses.forEach(parse => {
        if (!playerParses[parse.playerName]) {
          playerParses[parse.playerName] = {
            playerName: parse.playerName,
            class: parse.class,
            spec: parse.spec, // Will use the most recent spec
            parses: []
          };
        }
        
        playerParses[parse.playerName].parses.push(parse.percentile);
      });
    });
    
    // Calculate averages for each player
    const playerAverages = Object.values(playerParses).map(player => {
      const average = player.parses.reduce((sum, val) => sum + val, 0) / player.parses.length;
      return {
        ...player,
        averagePercentile: Math.round(average),
        totalParses: player.parses.length
      };
    });
    
    // Sort by average percentile (highest first)
    return playerAverages.sort((a, b) => b.averagePercentile - a.averagePercentile);
  };

  const playerAverages = calculatePlayerAverages();

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Warcraft Logs Report Viewer</CardTitle>
          <CardDescription>Enter your report code to view player performance in {targetZone}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col space-y-2 sm:flex-row sm:space-y-0 sm:space-x-2">
            <Input
              value={reportCode}
              onChange={(e) => setReportCode(e.target.value)}
              placeholder="Report Code"
              className="sm:flex-1"
            />
            <Button onClick={fetchReport} disabled={loading}>
              {loading ? 'Loading...' : 'Fetch Report Data'}
            </Button>
          </div>
        </CardContent>
      </Card>
      
      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      {loading && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Loading Data</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
            </div>
          </CardContent>
        </Card>
      )}
      
      {reportTitle && players.length > 0 && !loading && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{reportTitle}</CardTitle>
            <CardDescription>Raid Composition ({players.length} players)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {players.map(player => (
                <div 
                  key={player.id} 
                  className="p-2 bg-muted rounded flex flex-col"
                  style={{ borderLeft: `4px solid ${getClassColor(player.class || 'Unknown')}` }}
                >
                  <div className="font-medium">{player.name}</div>
                  {player.class && (
                    <div className="text-xs text-muted-foreground">
                      {player.spec} {player.class}
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground">
                    {player.server} ({player.region})
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      
      {Object.keys(fightParses).length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{targetZone} Boss Fights</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue={selectedFight} onValueChange={setSelectedFight}>
              <TabsList className="mb-4 flex flex-wrap h-auto">
                {Object.keys(fightParses).map(fightName => (
                  <TabsTrigger key={fightName} value={fightName} className="mb-1">
                    {fightName}
                  </TabsTrigger>
                ))}
              </TabsList>
              
              {Object.keys(fightParses).map(fightName => (
                <TabsContent key={fightName} value={fightName}>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between flex-wrap">
                      <h3 className="text-lg font-bold">{fightName} Performance</h3>
                      {fightParses[fightName].fightDetails && (
                        <div className="text-sm text-muted-foreground">
                          <span>Fight ID: {fightParses[fightName].fightId}</span>
                          <span className="ml-4">
                            Duration: {formatTime(
                              fightParses[fightName].fightDetails.end - 
                              fightParses[fightName].fightDetails.start
                            )}
                            {fightParses[fightName].fightDetails.kill && 
                              <Badge variant="outline" className="ml-2 bg-green-500/10">Kill</Badge>
                            }
                            {!fightParses[fightName].fightDetails.kill && 
                              <Badge variant="outline" className="ml-2 bg-red-500/10">Wipe</Badge>
                            }
                          </span>
                        </div>
                      )}
                    </div>
                    
                    <Separator />
                    
                    {fightParses[fightName].parses.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Rank</TableHead>
                            <TableHead>Player</TableHead>
                            <TableHead>Spec</TableHead>
                            <TableHead>Percentile</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {fightParses[fightName].parses.map((parse, index) => (
                            <TableRow key={index}>
                              <TableCell>{index + 1}</TableCell>
                              <TableCell>
                                <span style={{ color: getClassColor(parse.class) }}>
                                  {parse.playerName}
                                </span>
                              </TableCell>
                              <TableCell>{parse.spec}</TableCell>
                              <TableCell>
                                <Badge variant={getPercentileBadgeVariant(parse.percentile)}>
                                  {parse.percentile}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <div className="p-4 bg-muted rounded text-center">
                        No parse data found for this fight.
                      </div>
                    )}
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>
      )}
      
      {playerAverages.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Player Average Performance</CardTitle>
            <CardDescription>Average parse percentiles across all fights</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rank</TableHead>
                  <TableHead>Player</TableHead>
                  <TableHead>Class/Spec</TableHead>
                  <TableHead>Avg. Percentile</TableHead>
                  <TableHead>Fights</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {playerAverages.map((player, index) => (
                  <TableRow key={player.playerName}>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell>
                      <span style={{ color: getClassColor(player.class) }}>
                        {player.playerName}
                      </span>
                    </TableCell>
                    <TableCell>{player.spec} {player.class}</TableCell>
                    <TableCell>
                      <Badge variant={getPercentileBadgeVariant(player.averagePercentile)}>
                        {player.averagePercentile}
                      </Badge>
                    </TableCell>
                    <TableCell>{player.totalParses}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default WarcraftLogsReport;
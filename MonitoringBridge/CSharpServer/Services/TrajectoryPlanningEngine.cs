using System;
using System.Collections.Generic;
using System.Linq;
using MonitoringBridge.Server.Models;

namespace MonitoringBridge.Server.Services
{
    /**
     * 🚀 TrajectoryPlanningEngine (v2025.3)
     * Optimized genetic algorithm for spatial and contextual trajectory planning.
     */
    public class TrajectoryPlanningEngine
    {
        public List<Trajectory> EvolutionPlanning(string region, List<TourismInfo> pool, string userQuery = "", int populationSize = 8)
        {
            if (pool.Count < 3) return new List<Trajectory>();

            BuildLocalGraph(pool);

            var population = new List<Trajectory>();
            var rnd = new Random();

            for (int i = 0; i < populationSize; i++)
            {
                var proto = new Trajectory { Region = region };
                var startNode = pool.OrderBy(x => MatchScore(x, userQuery) * rnd.NextDouble()).Last();
                proto.Points.Add(startNode);

                for (int step = 0; step < rnd.Next(3, 6); step++)
                {
                    var last = proto.Points.Last();
                    var next = pool
                        .Where(p => !proto.Points.Any(existing => existing.Name == p.Name))
                        .OrderBy(p => GetDistance(last, p) * 0.7 - MatchScore(p, userQuery) * 0.3)
                        .FirstOrDefault();

                    if (next != null) proto.Points.Add(next);
                    else break;
                }

                CalculateScores(proto, userQuery);
                population.Add(proto);
            }

            for (int g = 0; g < 2; g++)
            {
                population = population.OrderByDescending(p => p.EfficiencyScore + p.DiversityScore + p.RelevanceScore).ToList();
                var elites = population.Take(3).ToList();

                var child = new Trajectory
                {
                    Region = region,
                    Points = elites[0].Points.Take(2).Concat(elites[1].Points.Skip(2).Take(2)).Distinct().ToList()
                };

                if (child.Points.Count > 0)
                {
                    CalculateScores(child, userQuery);
                    population.Add(child);
                }
            }

            return population.OrderByDescending(p => p.EfficiencyScore + p.DiversityScore + p.RelevanceScore).Take(3).ToList();
        }

        private void BuildLocalGraph(List<TourismInfo> pool)
        {
            foreach (var poi in pool)
            {
                poi.Neighbors = pool
                    .Where(other => other.Name != poi.Name)
                    .Select(other => new { other.Name, Dist = GetDistance(poi, other) })
                    .OrderBy(x => x.Dist)
                    .Take(5)
                    .ToDictionary(x => x.Name, x => x.Dist);
            }
        }

        private double GetDistance(TourismInfo a, TourismInfo b)
        {
            return Math.Sqrt(Math.Pow(a.Lat - b.Lat, 2) + Math.Pow(a.Lng - b.Lng, 2));
        }

        private double MatchScore(TourismInfo p, string query)
        {
            if (string.IsNullOrEmpty(query)) return 1.0;
            double score = 1.0;
            if (p.Name.Contains(query)) score += 5.0;
            if (p.Description.Contains(query)) score += 2.0;
            foreach (var t in p.Tags) if (query.Contains(t)) score += 1.5;
            return score;
        }

        private void CalculateScores(Trajectory t, string query)
        {
            double dist = 0;
            for (int i = 0; i < t.Points.Count - 1; i++)
                dist += GetDistance(t.Points[i], t.Points[i + 1]);

            t.EfficiencyScore = t.Points.Count / (dist + 0.1);
            t.DiversityScore = t.Points.SelectMany(p => p.Tags).Distinct().Count();
            t.RelevanceScore = t.Points.Sum(p => MatchScore(p, query));
            t.Reasoning = $"Efficiency: {t.EfficiencyScore:F2}, Diversity: {t.DiversityScore:F1}, Relevance: {t.RelevanceScore:F1}";
        }
    }
}
